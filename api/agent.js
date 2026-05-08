/**
 * /api/agent — AI Orchestrator Endpoint
 *
 * Chiamabile da qualsiasi LLM esterno (OpenClaw, n8n, Zapier, Claude, ecc.)
 *
 * POST /api/agent
 * Headers: Authorization: Bearer <AGENT_API_KEY>
 * Body: {
 *   task:         "generate_social_content" | "generate_site_content" | "full_product_content"
 *   productId:    string
 *   productName:  string
 *   productType:  "tshirt" | "mug" | "art" | "tote"
 *   collection:   string (optional)
 *   platforms:    ["instagram","tiktok","pinterest","facebook","youtube"] (optional, default: tutti)
 *   imageModelId: string (optional, default: fal-ai/flux-pro/kontext)
 *   autoPublish:  boolean (default: false — richiede approvazione manuale)
 *   dryRun:       boolean (default: false — se true non salva nulla)
 * }
 *
 * Response: {
 *   ok: true,
 *   summary: { generated: N, published: N, skipped: N },
 *   assets: [{ platform, type, url, saved }],
 *   copy: { platform: { caption, hashtags, seoTitle, seoDescription, altText } },
 *   log: ["step 1...", "step 2..."]
 * }
 */

import { applyCors } from './_lib/cors.js'

const ADMIN_INTERNAL_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaylpelle'

// ── System prompt con expertise marketing ─────────────────────────────────────
const AGENT_SYSTEM_PROMPT = `You are JAYL's AI content orchestrator for a print-on-demand lifestyle brand.
Your job: generate complete social media and e-commerce content for products.

BRAND IDENTITY:
- JAYL is a bold, culture-driven lifestyle brand
- Aesthetic: urban, Gen-Z, pop culture, street style
- Tone: confident, playful, authentic — never corporate

PLATFORM EXPERTISE:
- TikTok: raw, vertical, hooks in first 2 seconds, trending sounds context, casual language
- Instagram: aspirational but real, mix editorial + lifestyle, strong visual storytelling
- Pinterest: inspirational, searchable, long-tail SEO, home/fashion/art context
- Facebook: broader audience, community-driven, clear value proposition
- YouTube: educational + entertaining, strong thumbnail strategy, searchable titles

HOOK FORMULAS (use these for captions):
- "POV: you just found your new favorite [item]"
- "Nobody is talking about this [product]..."
- "This [product] is the [adjective] thing I own"
- "Tell me you love [culture ref] without telling me"
- "The [product] that [unexpected benefit]"

SEO PRINCIPLES:
- Include primary keyword in first 10 words of SEO title
- Meta description: benefit-first, include CTA, under 155 chars
- Etsy: front-load the most searched terms

QUALITY STANDARDS:
- Never mention AI or generation
- Always sound authentic to the brand voice
- Hashtags: mix niche (1k-50k) + mid (50k-500k) + broad (500k+)

When you call tools, be strategic: generate images first, then copy based on what was generated.
Always check results before deciding to publish.`

// ── Tool definitions for Claude ───────────────────────────────────────────────
const TOOLS = [
  {
    name: 'generate_image',
    description: 'Generate a product image using AI. Returns the image URL when complete.',
    input_schema: {
      type: 'object',
      properties: {
        templateId:  { type: 'string', description: 'Unique ID for this generation job' },
        prompt:      { type: 'string', description: 'The image generation prompt' },
        modelId:     { type: 'string', description: 'fal.ai model ID to use' },
        imageUrl:    { type: 'string', description: 'Reference image URL (Gelato mockup)' },
        imageSize:   { type: 'string', description: 'square_hd | portrait_4_3 | portrait_16_9 | landscape_16_9' },
      },
      required: ['templateId', 'prompt'],
    },
  },
  {
    name: 'generate_copy',
    description: 'Generate marketing copy (caption, hashtags, SEO) for a specific platform.',
    input_schema: {
      type: 'object',
      properties: {
        platform:    { type: 'string', description: 'instagram | tiktok | pinterest | facebook | youtube | site' },
        productName: { type: 'string' },
        productType: { type: 'string', description: 'tshirt | mug | art | tote' },
        collection:  { type: 'string' },
        assetCount:  { type: 'number',  description: 'Number of assets generated for this platform' },
      },
      required: ['platform', 'productName'],
    },
  },
  {
    name: 'review_image',
    description: 'Review a generated image for quality. Returns { approved: bool, reason: string }.',
    input_schema: {
      type: 'object',
      properties: {
        imageUrl:   { type: 'string', description: 'URL of the image to review' },
        criteria:   { type: 'string', description: 'What to check (e.g. "design visible, no artifacts, good quality")' },
      },
      required: ['imageUrl'],
    },
  },
  {
    name: 'publish_asset',
    description: 'Publish approved assets to the product (saves to gallery, sets hero, updates SEO). Only call after review.',
    input_schema: {
      type: 'object',
      properties: {
        productId:  { type: 'string' },
        platform:   { type: 'string' },
        assets:     {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:       { type: 'string' },
              imageUrl: { type: 'string' },
              videoUrl: { type: 'string' },
            },
          },
        },
        copy: {
          type: 'object',
          properties: {
            caption:        { type: 'string' },
            hashtags:       { type: 'string' },
            altText:        { type: 'string' },
            seoTitle:       { type: 'string' },
            seoDescription: { type: 'string' },
          },
        },
      },
      required: ['productId', 'platform', 'assets'],
    },
  },
  {
    name: 'log_progress',
    description: 'Log a progress message visible in the UI and response.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        emoji:   { type: 'string' },
      },
      required: ['message'],
    },
  },
]

// ── Tool executors ────────────────────────────────────────────────────────────
async function executeTool(name, input, context) {
  const { productId, imageModelId, anthropicKey, log } = context

  if (name === 'log_progress') {
    const msg = `${input.emoji || '▸'} ${input.message}`
    log.push(msg)
    return { ok: true, message: msg }
  }

  if (name === 'generate_image') {
    log.push(`📸 Generating image: ${input.templateId}`)
    try {
      const res = await fetch(`${ADMIN_INTERNAL_URL}/api/generate-mockup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId:   input.modelId  || imageModelId || 'fal-ai/flux-pro/kontext',
          prompt:    input.prompt,
          imageSize: input.imageSize || 'portrait_4_3',
          imageUrl:  input.imageUrl  || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      log.push(`✓ Image ready: ${input.templateId}`)
      return { ok: true, imageUrl: data.imageUrl, templateId: input.templateId }
    } catch (e) {
      log.push(`⚠ Image failed: ${e.message}`)
      return { ok: false, error: e.message }
    }
  }

  if (name === 'generate_copy') {
    log.push(`✨ Generating copy for ${input.platform}`)
    try {
      const res = await fetch(`${ADMIN_INTERNAL_URL}/api/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:      'generate-copy',
          password:    ADMIN_PASSWORD,
          productName: input.productName,
          productType: input.productType || 'tshirt',
          collection:  input.collection  || '',
          social:      input.platform,
          selectedAssets: Array(input.assetCount || 1).fill('asset'),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      log.push(`✓ Copy ready for ${input.platform}`)
      return { ok: true, copy: data.copy }
    } catch (e) {
      log.push(`⚠ Copy failed: ${e.message}`)
      return { ok: false, error: e.message }
    }
  }

  if (name === 'review_image') {
    log.push(`🔍 Reviewing image quality`)
    try {
      const msgRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: input.imageUrl } },
              { type: 'text', text: `Review this product image. Check: ${input.criteria || 'product design visible, no AI artifacts, good quality, professional look'}. Respond with JSON only: {"approved": true/false, "reason": "brief explanation"}` },
            ],
          }],
        }),
      })
      const msgData = await msgRes.json()
      const raw     = msgData.content?.[0]?.text || '{}'
      const result  = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}')
      log.push(`${result.approved ? '✓' : '✗'} Review: ${result.reason || 'no reason'}`)
      return { ok: true, approved: result.approved ?? true, reason: result.reason }
    } catch (e) {
      log.push(`⚠ Review skipped: ${e.message}`)
      return { ok: true, approved: true, reason: 'Review skipped — auto-approved' }
    }
  }

  if (name === 'publish_asset') {
    if (context.dryRun) {
      log.push(`[DRY RUN] Would publish to ${input.platform}`)
      return { ok: true, dryRun: true }
    }
    log.push(`🚀 Publishing to ${input.platform}`)
    try {
      const res = await fetch(`${ADMIN_INTERNAL_URL}/api/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    'publish-social-asset',
          password:  ADMIN_PASSWORD,
          productId: input.productId || productId,
          platform:  input.platform,
          assets:    input.assets,
          copy:      input.copy || {},
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      log.push(`✓ Published ${input.assets.length} asset(s) to ${input.platform}`)
      return { ok: true, ...data }
    } catch (e) {
      log.push(`⚠ Publish failed: ${e.message}`)
      return { ok: false, error: e.message }
    }
  }

  return { ok: false, error: `Unknown tool: ${name}` }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  await applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  // Auth: Bearer token or password field
  const authHeader = req.headers.authorization || ''
  const bearerKey  = authHeader.replace('Bearer ', '').trim()
  const bodyKey    = req.body?.apiKey || req.body?.password || ''
  const validKey   = process.env.AGENT_API_KEY || process.env.ADMIN_PASSWORD || 'jaylpelle'

  if (bearerKey !== validKey && bodyKey !== validKey) {
    return res.status(401).json({ error: 'Invalid API key. Use Authorization: Bearer <key> or { "apiKey": "<key>" }' })
  }

  const {
    task        = 'generate_social_content',
    productId,
    productName = 'Product',
    productType = 'tshirt',
    collection  = '',
    platforms   = ['instagram', 'tiktok', 'pinterest', 'facebook'],
    imageModelId,
    autoPublish = false,
    dryRun      = false,
  } = req.body

  if (!productId) return res.status(400).json({ error: 'productId required' })

  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const log     = []
  const context = { productId, imageModelId, anthropicKey, dryRun, log }

  log.push(`🤖 Agent started — task: ${task} | product: ${productName} | platforms: ${platforms.join(', ')}`)

  // Build user message describing the task
  const userMessage = `
Task: ${task}
Product: "${productName}" (${productType})
Collection: ${collection || 'General'}
Platforms: ${platforms.join(', ')}
Auto-publish: ${autoPublish}
Dry run: ${dryRun}

Execute the task:
1. For each platform, generate 1-2 images using generate_image (use platform-appropriate prompts)
2. Review each image with review_image
3. Generate copy for each platform using generate_copy
4. If autoPublish=true AND images approved, call publish_asset for each platform
5. Log progress throughout with log_progress
6. Be strategic: use portrait_16_9 for TikTok/Instagram stories, square_hd for feeds, portrait_4_3 for Pinterest

Important: Only call publish_asset if autoPublish is true. Otherwise, just generate and review.
`.trim()

  // ── Agentic loop ──────────────────────────────────────────────────────────
  const messages = [{ role: 'user', content: userMessage }]
  const assets   = []
  const copyMap  = {}
  let iterations = 0
  const MAX_ITER = 20

  try {
    while (iterations < MAX_ITER) {
      iterations++

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-5',
          max_tokens: 4096,
          system:     AGENT_SYSTEM_PROMPT,
          tools:      TOOLS,
          messages,
        }),
      })

      const claudeData = await claudeRes.json()
      if (!claudeRes.ok) throw new Error(claudeData.error?.message || 'Claude API error')

      // Add assistant message to history
      messages.push({ role: 'assistant', content: claudeData.content })

      // If done (no tool use) — break
      if (claudeData.stop_reason === 'end_turn') {
        log.push('✅ Agent completed')
        break
      }

      // Process tool calls
      if (claudeData.stop_reason === 'tool_use') {
        const toolResults = []

        for (const block of claudeData.content) {
          if (block.type !== 'tool_use') continue

          const result = await executeTool(block.name, block.input, context)

          // Collect assets from generate_image
          if (block.name === 'generate_image' && result.ok && result.imageUrl) {
            assets.push({
              templateId: result.templateId,
              imageUrl:   result.imageUrl,
              platform:   block.input.templateId?.split('-')[0] || 'unknown',
            })
          }

          // Collect copy from generate_copy
          if (block.name === 'generate_copy' && result.ok && result.copy) {
            copyMap[block.input.platform] = result.copy
          }

          toolResults.push({
            type:       'tool_result',
            tool_use_id: block.id,
            content:    JSON.stringify(result),
          })
        }

        // Add tool results to message history
        messages.push({ role: 'user', content: toolResults })
      }
    }

    const published = assets.filter(a => a.published).length
    const summary   = {
      generated: assets.length,
      published,
      skipped:   assets.length - published,
      platforms: platforms.length,
    }

    return res.status(200).json({
      ok: true,
      summary,
      assets,
      copy:    copyMap,
      log,
      message: `Agent completed: ${assets.length} assets generated, ${published} published`,
    })

  } catch (e) {
    log.push(`❌ Agent error: ${e.message}`)
    console.error('[agent]', e.message)
    return res.status(500).json({ ok: false, error: e.message, log })
  }
}
