import { applyCors }       from './_lib/cors.js'
import { proxyImageToFal } from './_lib/falStorage.js'

// ── Allowed base model IDs (sent from frontend) ─────────────────────────────

const IMAGE_MODELS = new Set([
  'fal-ai/flux/schnell',
  'fal-ai/flux-pro/v1.1',
  'fal-ai/flux-pro',              // legacy
  'fal-ai/flux/dev',              // legacy
  'fal-ai/flux-pro/kontext',      // ★ best for product-faithful img2img
  'fal-ai/flux-pro/kontext/max',  // ★ higher quality Kontext
  'fal-ai/ideogram/v3',
  'fal-ai/nano-banana-2',
  'fal-ai/recraft-v3',
])

// ── img2img routing ──────────────────────────────────────────────────────────
// Flux t2i base endpoints silently ignore image_url → route to redux variants.
// Ideogram t2i base endpoint → route to /remix for img2img.
// Kontext uses the same endpoint for both t2i and i2i (image_url is optional).

const T2I_TO_I2I = {
  'fal-ai/flux/schnell':  'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1': 'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux-pro':      'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev':      'fal-ai/flux/dev-redux',
  'fal-ai/ideogram/v3':   'fal-ai/ideogram/v3/remix',
  // Kontext: same endpoint, image_url just becomes required — no redirect needed
}

// Redux models: accept image_url but NOT strength (style conditioning, not blending)
const REDUX_MODELS = new Set([
  'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev-redux',
])

// Kontext models: aspect_ratio + safety_tolerance; image_url is reference for editing
const KONTEXT_MODELS = new Set([
  'fal-ai/flux-pro/kontext',
  'fal-ai/flux-pro/kontext/max',
])

// Models that are strictly text-to-image — no img2img support at all
const T2I_ONLY = new Set([
  'fal-ai/nano-banana-2',
  'fal-ai/recraft-v3',
])

// ── Param adapters ───────────────────────────────────────────────────────────

const IMAGE_SIZE_TO_ASPECT = {
  square_hd:      '1:1',
  square:         '1:1',
  portrait_16_9:  '9:16',
  landscape_16_9: '16:9',
  portrait_4_3:   '3:4',
  landscape_4_3:  '4:3',
}

// Build the model-specific request body
function buildBody(effectiveModelId, { prompt, imageSize, falImageUrl }) {
  const aspect = IMAGE_SIZE_TO_ASPECT[imageSize] || '1:1'

  // Kontext: instruction-based image editing
  if (KONTEXT_MODELS.has(effectiveModelId)) {
    return {
      prompt,
      ...(falImageUrl ? { image_url: falImageUrl } : {}),
      aspect_ratio:     aspect,
      num_images:       1,
      safety_tolerance: '4',
      guidance_scale:   3.5,
    }
  }

  // Nano Banana: t2i, different param names
  if (effectiveModelId === 'fal-ai/nano-banana-2') {
    return {
      prompt,
      aspect_ratio:     aspect,
      num_images:       1,
      safety_tolerance: '4',
    }
  }

  // Redux (Flux img2img): image_url only, no strength
  if (REDUX_MODELS.has(effectiveModelId)) {
    return {
      prompt,
      ...(falImageUrl ? { image_url: falImageUrl } : {}),
      image_size:            imageSize || 'square_hd',
      num_images:            1,
      enable_safety_checker: false,
    }
  }

  // Standard (Flux t2i, Recraft, Ideogram remix)
  return {
    prompt,
    ...(falImageUrl ? { image_url: falImageUrl, strength: 0.85 } : {}),
    image_size:            imageSize || 'square_hd',
    num_images:            1,
    enable_safety_checker: false,
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed)                 return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = (process.env.FAL_KEY || process.env.FALAI_API_KEY || '').trim()
  if (!apiKey) return res.status(500).json({ error: 'FAL_KEY not configured' })

  const { modelId, prompt, imageSize, imageUrl } = req.body || {}
  if (!prompt?.trim())            return res.status(400).json({ error: 'prompt is required' })
  if (!IMAGE_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown model: ${modelId}` })

  const canI2I = !T2I_ONLY.has(modelId)

  // Resolve effective model endpoint (Flux → redux, Ideogram → remix, Kontext stays)
  const effectiveModelId = (imageUrl && canI2I && T2I_TO_I2I[modelId])
    ? T2I_TO_I2I[modelId]
    : modelId

  // Proxy reference image to fal.ai CDN so all model servers can reach it reliably
  let falImageUrl = undefined
  if (imageUrl && canI2I) {
    try {
      falImageUrl = await proxyImageToFal(imageUrl, apiKey)
      console.log('[generate-mockup] image proxied to fal CDN:', falImageUrl.slice(0, 60) + '…')
    } catch (e) {
      console.warn('[generate-mockup] image proxy failed, falling back to direct URL:', e.message)
      // Fall back to original URL — works for Gelato CDN / production Vercel URLs
      falImageUrl = imageUrl
    }
  }

  const body = buildBody(effectiveModelId, {
    prompt: buildPromptText(prompt),
    imageSize,
    falImageUrl,
  })

  try {
    const falRes = await fetch(`https://fal.run/${effectiveModelId}`, {
      method:  'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    const responseBody = await falRes.json().catch(() => null)

    if (!falRes.ok) {
      console.error('[generate-mockup] fal error', falRes.status, responseBody)
      return res.status(falRes.status).json({
        error: responseBody?.detail || responseBody?.message || `fal.ai error ${falRes.status}`,
      })
    }

    const imageUrlOut = responseBody?.images?.[0]?.url ?? responseBody?.image?.url ?? null
    if (!imageUrlOut) {
      console.error('[generate-mockup] unexpected response', JSON.stringify(responseBody).slice(0, 300))
      return res.status(500).json({ error: 'No image URL in fal.ai response' })
    }

    return res.status(200).json({ imageUrl: imageUrlOut })
  } catch (err) {
    console.error('[generate-mockup]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// Strip persona context injected by frontend (handled server-side if needed)
function buildPromptText(prompt) {
  return (prompt || '').trim()
}
