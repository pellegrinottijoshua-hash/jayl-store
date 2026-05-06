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

// ── OpenAI direct image edit ──────────────────────────────────────────────────
// Bypasses fal.ai entirely. Fetches reference image as bytes → multipart POST
// to OpenAI's /v1/images/edits. Returns base64 data URL (no external CDN needed).

const GPT_OPENAI_SIZE = {
  square_hd:      '1024x1024',
  square:         '1024x1024',
  landscape_16_9: '1536x1024',
  landscape_4_3:  '1536x1024',
  portrait_16_9:  '1024x1536',
  portrait_4_3:   '1024x1536',
}

async function callOpenAIImageEdit({ prompt, imageUrl, imageSize, openAIKey, model = 'gpt-image-1' }) {
  const size = GPT_OPENAI_SIZE[imageSize] || '1024x1024'

  // Build multipart form
  const form = new FormData()
  form.append('model', model || 'gpt-image-1')
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('size', size)
  form.append('quality', 'auto')

  if (imageUrl && !imageUrl.includes('localhost')) {
    // Fetch reference image bytes from the public URL (Gelato CDN, GitHub, Vercel, etc.)
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) })
    if (!imgRes.ok) throw new Error(`Cannot fetch reference image (HTTP ${imgRes.status})`)
    const imgBuffer  = await imgRes.arrayBuffer()
    const mimeType   = imgRes.headers.get('content-type') || 'image/png'
    const ext        = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
    // OpenAI requires PNG for edit endpoint — convert JPEG label to png
    form.append('image[]', new Blob([imgBuffer], { type: 'image/png' }), `mockup.${ext}`)
  }

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method:  'POST',
    headers: { Authorization: `Bearer ${openAIKey}` },
    body:    form,
    signal:  AbortSignal.timeout(120_000),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${data.error?.message || JSON.stringify(data)}`)

  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image in OpenAI response')

  // Return as data URL — browser can display it; save flow handles base64 decoding
  return `data:image/png;base64,${b64}`
}

async function callOpenAIImageT2I({ prompt, imageSize, openAIKey, model = 'gpt-image-1' }) {
  const size = GPT_OPENAI_SIZE[imageSize] || '1024x1024'
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method:  'POST',
    headers: { Authorization: `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, n: 1, size, quality: 'auto' }),
    signal: AbortSignal.timeout(120_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${data.error?.message || JSON.stringify(data)}`)
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image in OpenAI response')
  return `data:image/png;base64,${b64}`
}

const IMAGE_MODELS = new Set([
  // OpenAI direct (no fal.ai)
  'openai/gpt-image-1',
  'openai/gpt-image-2/edit',
  // Flux family
  'fal-ai/flux/schnell',
  'fal-ai/flux-pro/v1.1',
  'fal-ai/flux-pro',
  'fal-ai/flux/dev',
  'fal-ai/flux-pro/kontext',
  'fal-ai/flux-pro/kontext/max',
  // Ideogram
  'fal-ai/ideogram/v3',
  // Nano Banana
  'fal-ai/nano-banana-2',
  'fal-ai/nano-banana-2/edit',
  'fal-ai/nano-banana-pro',
  // Recraft
  'fal-ai/recraft-v3',
  // GPT Image 1 (OpenAI via fal.ai) — user selects t2i; backend auto-switches to edit when image provided
  'fal-ai/gpt-image-1/text-to-image',
])

// When a reference image is provided, switch to the model's img2img variant
const T2I_TO_I2I_IMG = {
  'fal-ai/flux/schnell':              'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1':             'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux-pro':                  'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev':                  'fal-ai/flux/dev-redux',
  'fal-ai/ideogram/v3':               'fal-ai/ideogram/v3/remix',
  // GPT Image 1: text-to-image → edit-image (true img2img via image_urls array)
  'fal-ai/gpt-image-1/text-to-image': 'fal-ai/gpt-image-1/edit-image',
  // Nano Banana Pro: t2i base → /edit endpoint (image_urls array, true img2img)
  'fal-ai/nano-banana-pro':           'fal-ai/nano-banana-pro/edit',
  'fal-ai/nano-banana-2':             'fal-ai/nano-banana-2/edit',
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

const GPT_IMAGE_MODELS = new Set([
  'fal-ai/gpt-image-1/text-to-image',
  'fal-ai/gpt-image-1/edit-image',
])

// Strictly text-to-image — no img2img endpoint exists for these
const T2I_ONLY = new Set([
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

// GPT Image 1 uses pixel dimensions, not fal aspect_ratio strings
const IMAGE_SIZE_TO_GPT = {
  square_hd:      '1024x1024',
  square:         '1024x1024',
  portrait_16_9:  '1024x1536',
  landscape_16_9: '1536x1024',
  portrait_4_3:   '1024x1536',
  landscape_4_3:  '1536x1024',
}

const NANO_MODELS = new Set(['fal-ai/nano-banana-2', 'fal-ai/nano-banana-pro'])

function buildMockupBody(effectiveModelId, { prompt, imageSize, falImageUrl }) {
  const aspect   = IMAGE_SIZE_TO_ASPECT[imageSize] || '1:1'
  const gptSize  = IMAGE_SIZE_TO_GPT[imageSize]    || '1024x1024'

  // GPT Image 1 — edit (img2img): requires image_urls array
  if (effectiveModelId === 'fal-ai/gpt-image-1/edit-image') {
    return {
      prompt,
      image_urls:     falImageUrl ? [falImageUrl] : [],
      image_size:     gptSize,
      input_fidelity: 'high',
      quality:        'auto',
      num_images:     1,
      output_format:  'png',
    }
  }

  // GPT Image 1 — text-to-image (no reference)
  if (effectiveModelId === 'fal-ai/gpt-image-1/text-to-image') {
    return {
      prompt,
      image_size:    gptSize,
      quality:       'auto',
      num_images:    1,
      output_format: 'png',
    }
  }

  // Kontext: instruction-based editing
  if (KONTEXT_MODELS.has(effectiveModelId)) {
    return { prompt, ...(falImageUrl ? { image_url: falImageUrl } : {}), aspect_ratio: aspect, num_images: 1, safety_tolerance: '4', guidance_scale: 3.5 }
  }

  // Nano Banana Pro /edit — true img2img via image_urls array
  if (effectiveModelId === 'fal-ai/nano-banana-pro/edit') {
    return {
      prompt,
      image_urls:      falImageUrl ? [falImageUrl] : [],
      aspect_ratio:    aspect,
      num_images:      1,
      safety_tolerance: '4',
    }
  }

  // Nano Banana 2 /edit — true img2img via image_urls array
  if (effectiveModelId === 'fal-ai/nano-banana-2/edit') {
    return {
      prompt,
      image_urls:       falImageUrl ? [falImageUrl] : [],
      aspect_ratio:     aspect,
      num_images:       1,
      safety_tolerance: '4',
    }
  }

  // Nano Banana family (t2i): aspect_ratio + safety_tolerance, no image fields
  if (NANO_MODELS.has(effectiveModelId)) {
    return { prompt, aspect_ratio: aspect, num_images: 1, safety_tolerance: '4' }
  }

  // Flux redux (img2img via style conditioning): image_url only, no strength
  if (REDUX_MODELS.has(effectiveModelId)) {
    return { prompt, ...(falImageUrl ? { image_url: falImageUrl } : {}), image_size: imageSize || 'square_hd', num_images: 1, enable_safety_checker: false }
  }

  // Default (Flux t2i, Recraft, Ideogram remix)
  return { prompt, ...(falImageUrl ? { image_url: falImageUrl, strength: 0.85 } : {}), image_size: imageSize || 'square_hd', num_images: 1, enable_safety_checker: false }
}

async function handleMockup(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = (process.env.FAL_KEY || process.env.FALAI_API_KEY || '').trim()
  if (!apiKey) return res.status(500).json({ error: 'FAL_KEY not configured' })

  const { modelId, prompt, imageSize, imageUrl } = req.body || {}
  if (!prompt?.trim())            return res.status(400).json({ error: 'prompt is required' })
  if (!IMAGE_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown model: ${modelId}` })

  // ── Direct OpenAI path (bypass fal.ai entirely) ────────────────────────────
  if (modelId === 'openai/gpt-image-1' || modelId === 'openai/gpt-image-2/edit') {
    const openAIKey = process.env.OPENAI_API_KEY
    if (!openAIKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
    const openAIModel = modelId === 'openai/gpt-image-2/edit' ? 'gpt-image-2' : 'gpt-image-1'
    try {
      const dataUrl = imageUrl
        ? await callOpenAIImageEdit({ prompt: prompt.trim(), imageUrl, imageSize, openAIKey, model: openAIModel })
        : await callOpenAIImageT2I({ prompt: prompt.trim(), imageSize, openAIKey, model: openAIModel })
      return res.status(200).json({ imageUrl: dataUrl })
    } catch (err) {
      console.error('[openai-direct]', err.message)
      return res.status(500).json({ error: err.message })
    }
  }

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
  'fal-ai/ltx-video/image-to-video',
  'fal-ai/bytedance/seedance-2.0/image-to-video',
  'fal-ai/kling-video/v3/pro/image-to-video',
  'fal-ai/wan/v2.7/reference-to-video',
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
