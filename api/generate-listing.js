import { applyCors } from './_lib/cors.js'

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  const { productTitle, section, collection, movement } = req.body || {}
  if (!productTitle) return res.status(400).json({ error: 'productTitle is required' })

  const prompt = `You are a copywriter for JAYL, a premium art and objects store.
Generate listing content for the following product:

Product title: ${productTitle}
Section: ${section || 'objects'}
Collection: ${collection || ''}
Movement/style: ${movement || ''}

Return a JSON object with these exact keys:
- "seoTitle": An SEO-optimised product title (60-70 chars). Keep the product name prominent.
- "description": A compelling product description of exactly ~150 words. Evocative, minimal, no fluff. Mention materials, Gelato print quality, and the art style.
- "altText": A concise alt text for the product image (1 sentence, under 125 chars). Describe the visual clearly.
- "tags": An array of exactly 13 Etsy-style tags (strings). Mix product type, style, fandom, gift occasion. Each tag max 20 chars, lowercase, no special chars except spaces.

Return ONLY the JSON object, no markdown, no extra text.`

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}))
      throw new Error(`OpenAI error ${openaiRes.status}: ${err.error?.message || 'Unknown'}`)
    }

    const data = await openaiRes.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(content)

    // Normalise tags to array
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.slice(0, 13)
      : String(parsed.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 13)

    return res.status(200).json({
      seoTitle:    parsed.seoTitle    || productTitle,
      description: parsed.description || '',
      altText:     parsed.altText     || '',
      tags,
      model: data.model,
      usage: data.usage,
    })
  } catch (err) {
    console.error('[generate-listing]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
