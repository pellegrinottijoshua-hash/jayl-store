import { applyCors } from './_lib/cors.js'

// Base model IDs accepted from the frontend
const IMAGE_MODELS = new Set([
  'fal-ai/flux/schnell',
  'fal-ai/flux-pro/v1.1',
  'fal-ai/flux-pro',        // legacy
  'fal-ai/flux/dev',        // legacy
  'fal-ai/ideogram/v3',
  'fal-ai/nano-banana-2',
  'fal-ai/recraft-v3',
])

// Flux t2i base endpoints silently ignore image_url.
// Route to their dedicated img2img (redux) variants when a reference is provided.
// Ideogram's remix endpoint is its img2img equivalent.
const T2I_TO_I2I = {
  'fal-ai/flux/schnell':  'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1': 'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux-pro':      'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev':      'fal-ai/flux/dev-redux',
  'fal-ai/ideogram/v3':   'fal-ai/ideogram/v3/remix',
}

// Redux/img2img models that accept image_url but NOT a strength param
const REDUX_MODELS = new Set([
  'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev-redux',
])

// Models that are strictly text-to-image — image_url is silently ignored.
// Do NOT attempt img2img with these (no redirect, no imagePayload).
const T2I_ONLY = new Set([
  'fal-ai/nano-banana-2',
  'fal-ai/recraft-v3',
])

// Nano Banana uses different param names vs the standard Flux/Recraft schema
const IMAGE_SIZE_TO_ASPECT = {
  square_hd:      '1:1',
  square:         '1:1',
  portrait_16_9:  '9:16',
  landscape_16_9: '16:9',
  portrait_4_3:   '3:4',
  landscape_4_3:  '4:3',
}

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

  // T2I-only models: never attempt img2img
  const canI2I = !T2I_ONLY.has(modelId)

  // When a reference image is provided and model supports img2img, switch to its i2i variant
  const effectiveModelId = (imageUrl && canI2I && T2I_TO_I2I[modelId])
    ? T2I_TO_I2I[modelId]
    : modelId

  const isRedux  = REDUX_MODELS.has(effectiveModelId)
  const isNanoBanana = effectiveModelId === 'fal-ai/nano-banana-2'

  // Image reference payload:
  //   Redux models  → image_url only (style conditioning, no blending strength)
  //   Ideogram remix → image_url + strength (both required by its schema)
  //   T2I-only models → empty (image is ignored)
  const imagePayload = (imageUrl && canI2I)
    ? isRedux
      ? { image_url: imageUrl }
      : { image_url: imageUrl, strength: 0.85 }
    : {}

  // Build model-specific body (Nano Banana uses different param names)
  const requestBody = isNanoBanana
    ? {
        prompt:          prompt.trim(),
        aspect_ratio:    IMAGE_SIZE_TO_ASPECT[imageSize] || '1:1',
        num_images:      1,
        safety_tolerance: '4',
      }
    : {
        prompt:                prompt.trim(),
        image_size:            imageSize || 'square_hd',
        num_images:            1,
        enable_safety_checker: false,
        ...imagePayload,
      }

  try {
    const falRes = await fetch(`https://fal.run/${effectiveModelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const body = await falRes.json().catch(() => null)

    if (!falRes.ok) {
      console.error('[generate-mockup] fal error', falRes.status, body)
      return res.status(falRes.status).json({
        error: body?.detail || body?.message || `fal.ai error ${falRes.status}`,
      })
    }

    const imageUrlOut = body?.images?.[0]?.url ?? body?.image?.url ?? null
    if (!imageUrlOut) {
      console.error('[generate-mockup] unexpected response', JSON.stringify(body).slice(0, 300))
      return res.status(500).json({ error: 'No image URL in fal.ai response' })
    }

    return res.status(200).json({ imageUrl: imageUrlOut })
  } catch (err) {
    console.error('[generate-mockup]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
