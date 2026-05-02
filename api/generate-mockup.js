import { applyCors } from './_lib/cors.js'

const IMAGE_MODELS = new Set([
  'fal-ai/flux-pro',
  'fal-ai/flux/dev',
  'fal-ai/ideogram/v3',
  'fal-ai/recraft-v3',
  'fal-ai/nano-banana-2',
])

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed)                 return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = (process.env.FAL_KEY || process.env.FALAI_API_KEY || '').trim()
  if (!apiKey) return res.status(500).json({ error: 'FAL_KEY not configured' })

  const { modelId, prompt } = req.body || {}
  if (!prompt?.trim())            return res.status(400).json({ error: 'prompt is required' })
  if (!IMAGE_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown model: ${modelId}` })

  try {
    const falRes = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        image_size:  'square_hd',
        num_images:  1,
        enable_safety_checker: false,
      }),
    })

    const body = await falRes.json().catch(() => null)

    if (!falRes.ok) {
      console.error('[generate-mockup] fal error', falRes.status, body)
      return res.status(falRes.status).json({
        error: body?.detail || body?.message || `fal.ai error ${falRes.status}`,
      })
    }

    // fal.ai image response: { images: [{ url, width, height, content_type }], ... }
    const imageUrl = body?.images?.[0]?.url ?? body?.image?.url ?? null
    if (!imageUrl) {
      console.error('[generate-mockup] unexpected response', JSON.stringify(body).slice(0, 300))
      return res.status(500).json({ error: 'No image URL in fal.ai response' })
    }

    return res.status(200).json({ imageUrl })
  } catch (err) {
    console.error('[generate-mockup]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
