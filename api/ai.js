/**
 * api/ai.js — consolidated AI hub
 *
 * Replaces 4 separate functions to stay within Vercel Hobby's 12-function limit.
 * Routed via vercel.json rewrites that append ?handler=<name>:
 *   /api/generate-listing  → ?handler=listing
 *   /api/generate-mockup   → ?handler=mockup
 *   /api/generate-video    → ?handler=video
 *   /api/generate-persona  → ?handler=persona
 */

import { applyCors }       from './_lib/cors.js'
import { rateLimit }       from './_lib/rateLimit.js'
import { proxyImageToFal } from './_lib/falStorage.js'

// ── Shared helpers ────────────────────────────────────────────────────────────

function cors(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') { res.status(allowed ? 200 : 403).end(); return false }
  if (!allowed)                 { res.status(403).json({ error: 'Forbidden' }); return false }
  return true
}

// ── generate-listing ──────────────────────────────────────────────────────────

async function handleListing(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  const { productTitle, section, collection, movement } = req.body || {}
  if (!productTitle) return res.status(400).json({ error: 'productTitle is required' })

  const prompt = `You are a copywriter and SEO strategist for JAYL, a premium art and objects store.
Generate listing content and keyword research for the following product:

Product title: ${productTitle}
Section: ${section || 'objects'}
Collection: ${collection || ''}
Movement/style: ${movement || ''}

Return a JSON object with these exact keys:

— Listing fields —
- "seoTitle": An SEO-optimised product title (60-70 chars). Keep the product name prominent.
- "description": A compelling product description of exactly ~150 words. Evocative, minimal, no fluff. Mention materials, Gelato print quality, and the art style.
- "altText": A concise alt text for the product image (1 sentence, under 125 chars). Describe the visual clearly.
- "tags": An array of exactly 13 Etsy-style tags (strings). Mix product type, style, fandom, gift occasion. Each tag max 20 chars, lowercase, no special chars except spaces.

— Keyword research —
- "primaryKeywords": Array of 5 high-volume, short-tail SEO keywords (1-3 words). Focus on what buyers search on Google/Etsy/Pinterest.
- "longTailKeywords": Array of 10 long-tail keyword phrases (4-7 words). Specific buying intent, great for product descriptions and alt text.
- "hashtags": A single string with 30 Instagram hashtags. Mix niche (#snorlaxfan), category (#animetee), and broad (#artprint). Include the # symbol. Separated by spaces.
- "instagramCaption": A short, engaging Instagram caption (2-3 sentences max + call-to-action). Include 3-5 relevant hashtags inline. Tone: creative, slightly edgy, not corporate.
- "pinterestCaption": A Pinterest-optimised description (2-3 sentences). Keyword-rich, descriptive, helpful. No hashtags. Ends with a subtle call-to-action.

Return ONLY the JSON object, no markdown, no extra text.`

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        messages:        [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature:     0.7,
        max_tokens:      1400,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}))
      throw new Error(`OpenAI error ${openaiRes.status}: ${err.error?.message || 'Unknown'}`)
    }

    const data    = await openaiRes.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(content)

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.slice(0, 13)
      : String(parsed.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 13)

    return res.status(200).json({
      seoTitle:         parsed.seoTitle         || productTitle,
      description:      parsed.description      || '',
      altText:          parsed.altText          || '',
      tags,
      primaryKeywords:  Array.isArray(parsed.primaryKeywords)  ? parsed.primaryKeywords.slice(0, 5)  : [],
      longTailKeywords: Array.isArray(parsed.longTailKeywords) ? parsed.longTailKeywords.slice(0, 10) : [],
      hashtags:         parsed.hashtags         || '',
      instagramCaption: parsed.instagramCaption || '',
      pinterestCaption: parsed.pinterestCaption || '',
      model: data.model,
      usage: data.usage,
    })
  } catch (err) {
    console.error('[generate-listing]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── generate-mockup ───────────────────────────────────────────────────────────

const IMAGE_MODELS = new Set([
  'fal-ai/flux/schnell',
  'fal-ai/flux-pro/v1.1',
  'fal-ai/flux-pro',
  'fal-ai/flux/dev',
  'fal-ai/flux-pro/kontext',
  'fal-ai/flux-pro/kontext/max',
  'fal-ai/ideogram/v3',
  'fal-ai/nano-banana-2',
  'fal-ai/recraft-v3',
])

const T2I_TO_I2I_IMG = {
  'fal-ai/flux/schnell':  'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1': 'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux-pro':      'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev':      'fal-ai/flux/dev-redux',
  'fal-ai/ideogram/v3':   'fal-ai/ideogram/v3/remix',
}

const REDUX_MODELS = new Set([
  'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev-redux',
])

const KONTEXT_MODELS = new Set([
  'fal-ai/flux-pro/kontext',
  'fal-ai/flux-pro/kontext/max',
])

const T2I_ONLY = new Set([
  'fal-ai/nano-banana-2',
  'fal-ai/recraft-v3',
])

const IMAGE_SIZE_TO_ASPECT = {
  square_hd:      '1:1',
  square:         '1:1',
  portrait_16_9:  '9:16',
  landscape_16_9: '16:9',
  portrait_4_3:   '3:4',
  landscape_4_3:  '4:3',
}

function buildMockupBody(effectiveModelId, { prompt, imageSize, falImageUrl }) {
  const aspect = IMAGE_SIZE_TO_ASPECT[imageSize] || '1:1'
  if (KONTEXT_MODELS.has(effectiveModelId)) {
    return { prompt, ...(falImageUrl ? { image_url: falImageUrl } : {}), aspect_ratio: aspect, num_images: 1, safety_tolerance: '4', guidance_scale: 3.5 }
  }
  if (effectiveModelId === 'fal-ai/nano-banana-2') {
    return { prompt, aspect_ratio: aspect, num_images: 1, safety_tolerance: '4' }
  }
  if (REDUX_MODELS.has(effectiveModelId)) {
    return { prompt, ...(falImageUrl ? { image_url: falImageUrl } : {}), image_size: imageSize || 'square_hd', num_images: 1, enable_safety_checker: false }
  }
  return { prompt, ...(falImageUrl ? { image_url: falImageUrl, strength: 0.85 } : {}), image_size: imageSize || 'square_hd', num_images: 1, enable_safety_checker: false }
}

async function handleMockup(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = (process.env.FAL_KEY || process.env.FALAI_API_KEY || '').trim()
  if (!apiKey) return res.status(500).json({ error: 'FAL_KEY not configured' })

  const { modelId, prompt, imageSize, imageUrl } = req.body || {}
  if (!prompt?.trim())            return res.status(400).json({ error: 'prompt is required' })
  if (!IMAGE_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown model: ${modelId}` })

  const canI2I = !T2I_ONLY.has(modelId)
  const effectiveModelId = (imageUrl && canI2I && T2I_TO_I2I_IMG[modelId]) ? T2I_TO_I2I_IMG[modelId] : modelId

  let falImageUrl
  if (imageUrl && canI2I) {
    try {
      falImageUrl = await proxyImageToFal(imageUrl, apiKey)
    } catch (e) {
      console.warn('[generate-mockup] proxy failed, using direct URL:', e.message)
      falImageUrl = imageUrl
    }
  }

  const body = buildMockupBody(effectiveModelId, { prompt: prompt.trim(), imageSize, falImageUrl })

  try {
    const falRes = await fetch(`https://fal.run/${effectiveModelId}`, {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const responseBody = await falRes.json().catch(() => null)
    if (!falRes.ok) {
      console.error('[generate-mockup] fal error', falRes.status, responseBody)
      return res.status(falRes.status).json({ error: responseBody?.detail || responseBody?.message || `fal.ai error ${falRes.status}` })
    }
    const imageUrlOut = responseBody?.images?.[0]?.url ?? responseBody?.image?.url ?? null
    if (!imageUrlOut) return res.status(500).json({ error: 'No image URL in fal.ai response' })
    return res.status(200).json({ imageUrl: imageUrlOut })
  } catch (err) {
    console.error('[generate-mockup]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── generate-video ────────────────────────────────────────────────────────────

const VIDEO_MODELS = new Set([
  'fal-ai/ltx-video',
  'fal-ai/wan/v2.2/t2v',
  'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
  'fal-ai/kling-video/v1.6/standard/text-to-video',
  'fal-ai/kling-video/v3/pro/text-to-video',
  'fal-ai/ltx-video/image-to-video',
  'fal-ai/wan/v2.2/i2v',
  'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
  'fal-ai/kling-video/v1.6/standard/image-to-video',
  'fal-ai/kling-video/v3/pro/image-to-video',
])

async function handleVideo(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = (process.env.FAL_KEY || process.env.FALAI_API_KEY || '').trim()
  if (!apiKey) return res.status(500).json({ error: 'FAL_KEY not configured' })

  const { action, modelId, prompt, requestId, duration, imageUrl } = req.body || {}
  if (!VIDEO_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown video model: ${modelId}` })

  const baseUrl = `https://queue.fal.run/${modelId}`
  const hdrs    = { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' }

  try {
    if (action === 'submit') {
      if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' })
      const falRes = await fetch(baseUrl, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ prompt: prompt.trim(), duration: duration || '5', ...(imageUrl ? { image_url: imageUrl } : {}) }),
      })
      const data = await falRes.json().catch(() => null)
      if (!falRes.ok) return res.status(falRes.status).json({ error: data?.detail || data?.message || `fal.ai queue error ${falRes.status}` })
      return res.status(200).json({ requestId: data.request_id ?? data.requestId })
    }

    if (action === 'status') {
      if (!requestId) return res.status(400).json({ error: 'requestId required' })
      const falRes = await fetch(`${baseUrl}/requests/${requestId}/status`, { headers: hdrs })
      const body   = await falRes.json().catch(() => null)
      if (!falRes.ok) return res.status(falRes.status).json({ error: body?.detail || `Status check failed ${falRes.status}` })
      return res.status(200).json({ status: body.status, logs: body.logs ?? [] })
    }

    if (action === 'result') {
      if (!requestId) return res.status(400).json({ error: 'requestId required' })
      const falRes = await fetch(`${baseUrl}/requests/${requestId}`, { headers: hdrs })
      const body   = await falRes.json().catch(() => null)
      if (!falRes.ok) return res.status(falRes.status).json({ error: body?.detail || `Result fetch failed ${falRes.status}` })
      const videoUrl = body?.video?.url ?? body?.videos?.[0]?.url ?? null
      if (!videoUrl) return res.status(500).json({ error: 'No video URL in fal.ai response' })
      return res.status(200).json({ videoUrl })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('[generate-video]', action, err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── generate-persona ──────────────────────────────────────────────────────────

async function handlePersona(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  const { seed } = req.body || {}
  if (!seed?.trim()) return res.status(400).json({ error: 'seed description required' })

  const prompt = `You are creating a fictional social media influencer persona for JAYL, a premium art and objects store.
The persona will be used to market products on Instagram, TikTok, and YouTube.

Seed description from the store owner: "${seed.trim()}"

Create a fully fleshed-out influencer persona. Return a JSON object with these exact keys:

- "name": First name only (real-sounding, matches the vibe). No last name.
- "handle": Social handle (e.g. "@luna.vibes") — lowercase, no spaces, include @
- "bio": Short Instagram bio (max 150 chars). Emojis allowed. Should feel authentic and personal.
- "personality": 2-3 sentences describing their personality, tone, and how they communicate with followers.
- "aesthetic": 2-3 sentences describing their visual aesthetic — colours, lighting, settings, composition style.
- "contentStyle": 2-3 sentences describing the type of content they post — formats, themes, recurring elements.
- "targetAudience": One sentence describing their target audience (age range, interests, psychographics).
- "promptContext": A single compact string (max 80 chars) summarising their visual style for AI image generation. Example: "dark moody urban aesthetic, high contrast, neon accents, cinematic lighting"

Return ONLY the JSON object, no markdown, no extra text.`

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        messages:        [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature:     0.9,
        max_tokens:      700,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}))
      throw new Error(`OpenAI error ${openaiRes.status}: ${err.error?.message || 'Unknown'}`)
    }

    const data    = await openaiRes.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    return res.status(200).json(JSON.parse(content))
  } catch (err) {
    console.error('[generate-persona]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── Main router ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!cors(req, res)) return

  if (rateLimit(req, { max: 20, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const h = req.query.handler
  if (h === 'listing') return handleListing(req, res)
  if (h === 'mockup')  return handleMockup(req, res)
  if (h === 'video')   return handleVideo(req, res)
  if (h === 'persona') return handlePersona(req, res)

  return res.status(404).json({ error: `Unknown AI handler: ${h}` })
}
