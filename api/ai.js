/**
 * api/ai.js — consolidated AI hub
 *
 * Replaces 4 separate functions to stay within Vercel Hobby's 12-function limit.
 * Routed via vercel.json rewrites that append ?handler=<name>:
 *   /api/generate-listing        → ?handler=listing
 *   /api/generate-etsy-listing   → ?handler=etsy-listing
 *   /api/generate-social-listing → ?handler=social-listing
 *   /api/generate-mockup   → ?handler=mockup
 *   /api/generate-video    → ?handler=video
 *   /api/generate-persona  → ?handler=persona
 */

import { applyCors }       from './_lib/cors.js'
import { rateLimit }       from './_lib/rateLimit.js'
import { proxyImageToFal } from './_lib/falStorage.js'

// ── Shared helpers ────────────────────────────────────────────────────────────

// ── AI text provider config ───────────────────────────────────────────────────
// provider = 'openai' | 'longcat-flash' | 'longcat-thinking'
// Longcat uses OpenAI-compatible endpoint at https://api.longcat.chat/openai
const AI_PROVIDERS = {
  'openai':            { baseUrl: 'https://api.openai.com',              model: 'gpt-4o-mini',               keyEnv: 'OPENAI_API_KEY' },
  'longcat-flash':     { baseUrl: 'https://api.longcat.chat/openai',     model: 'LongCat-Flash-Chat',        keyEnv: 'LONGCAT_API_KEY' },
  'longcat-thinking':  { baseUrl: 'https://api.longcat.chat/openai',     model: 'LongCat-Flash-Thinking',    keyEnv: 'LONGCAT_API_KEY' },
}

async function callTextAI(prompt, { provider = 'openai', maxTokens = 1400, temperature = 0.7, jsonMode = true } = {}) {
  const cfg = AI_PROVIDERS[provider] ?? AI_PROVIDERS['openai']
  const apiKey = (process.env[cfg.keyEnv] || '').trim()
  if (!apiKey) throw new Error(`${cfg.keyEnv} not configured`)

  // Longcat and other OpenAI-compatible providers may not support response_format
  const isOpenAI   = provider === 'openai'
  const useJsonMode = jsonMode && isOpenAI

  const body = {
    model:       cfg.model,
    messages:    [{ role: 'user', content: prompt }],
    temperature,
    max_tokens:  maxTokens,
    ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
  }

  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(60_000),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${provider} error ${res.status}: ${data.error?.message || JSON.stringify(data)}`)
  let content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`Empty response from ${provider}`)

  // Strip markdown code fences if present (Longcat / non-JSON-mode responses)
  if (!useJsonMode) {
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  }

  return { content, model: data.model, usage: data.usage }
}

// Robust JSON parse — salvages truncated or markdown-fenced AI JSON so a
// slightly-too-long response never throws "Expected ',' or ']' …".
function safeJsonParse(content) {
  let s = String(content || '').replace(/```(?:json)?/gi, '').trim()
  const a = s.indexOf('{'), b = s.lastIndexOf('}')
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1)
  try { return JSON.parse(s) } catch (_) { /* repair below */ }
  // Detect if the string was truncated mid-value
  let inStr = false, esc = false, lastComma = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === ',') lastComma = i
  }
  // If we ended inside a string, drop the incomplete trailing element
  let fixed = inStr && lastComma > 0 ? s.slice(0, lastComma) : s.replace(/"[^"]*$/, '')
  fixed = fixed.replace(/,\s*$/, '')
  // Close any still-open arrays / objects
  const stack = []; let iS = false, eS = false
  for (let i = 0; i < fixed.length; i++) {
    const ch = fixed[i]
    if (eS) { eS = false; continue }
    if (ch === '\\') { eS = true; continue }
    if (ch === '"') { iS = !iS; continue }
    if (iS) continue
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  while (stack.length) fixed += stack.pop()
  return JSON.parse(fixed)
}

function cors(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') { res.status(allowed ? 200 : 403).end(); return false }
  if (!allowed)                 { res.status(403).json({ error: 'Forbidden' }); return false }
  return true
}

// ── generate-listing ──────────────────────────────────────────────────────────

async function handleListing(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { productTitle, section, collection, movement, provider = 'openai' } = req.body || {}
  if (!productTitle) return res.status(400).json({ error: 'productTitle is required' })

  // Site SEO only — intentionally excludes Etsy fields to keep response < 2k tokens
  const prompt = `You are a senior SEO copywriter for JAYL, a premium print-on-demand art and apparel brand.
Generate site listing content and keyword research for this product:

Product title: ${productTitle}
Section: ${section || 'objects'}
Collection: ${collection || ''}
Movement/style: ${movement || ''}

Return a JSON object with these EXACT keys (no other keys):

- "seoTitle": SEO meta title for the JAYL website. Format: "[Character] [Product Type] | [Keyword Hook] | [Style/Gift Context]". Target 50-65 chars. Do NOT include "JAYL". Example: "Mewtwo Pokemon T-Shirt | Retro 90s Anime Fan Gift".
- "description": ~130-150 words. STRICT RULES: (1) NEVER open with "Unleash", "Embrace", "Step up", "Level up", "Show off", "Discover", "Celebrate" or any generic hype verb — these are banned. (2) Every product needs its OWN angle rooted in the character's personality or cultural meaning (examples: Snorlax = lazy/mood energy; Psyduck = "me on a Monday" anxiety; Charizard = the OG flex, that kid who picked Charmander; Mewtwo = anti-hero arc; Dragonite = gentle giant who delivers mail then demolishes mountains; Ditto = identity/shapeshifter energy; Mew = rare/mythical/elusive; Zapdos = pure chaotic electricity). (3) Mention Gildan premium tee + DTG print quality. (4) One sentence on gifting. (5) Zero filler phrases like "perfect for any fan" or "ideal for anime lovers". Write like a human who actually knows the character.
- "altText": Concise alt text for hero image (1 sentence, under 125 chars).
- "tags": Array of exactly 13 tags (strings, lowercase, max 20 chars each, no special chars except spaces).
- "primaryKeywords": Array of 5 high-volume short-tail keywords (1-3 words each).
- "longTailKeywords": Array of 10 long-tail buying-intent phrases (4-7 words each).
- "hashtags": Single string with exactly 30 Instagram hashtags separated by spaces (include # on each).
- "instagramCaption": 2-3 sentences + CTA. Creative, slightly edgy. Include 3-5 hashtags inline.
- "pinterestCaption": 2-3 keyword-rich sentences, no hashtags, ends with subtle CTA.

Return ONLY the JSON object, no markdown, no extra text.`

  try {
    const { content, model, usage } = await callTextAI(prompt, { provider, maxTokens: 3000, temperature: 0.7 })

    const parsed = safeJsonParse(content)

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
      model,
      usage,
    })
  } catch (err) {
    console.error('[generate-listing]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── generate-etsy-listing ─────────────────────────────────────────────────────

async function handleEtsyListing(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { productTitle, section, collection, movement, provider = 'openai' } = req.body || {}
  if (!productTitle) return res.status(400).json({ error: 'productTitle is required' })

  const prompt = `You are a senior Etsy SEO strategist for JAYL, a premium print-on-demand art brand.
Generate Etsy-optimised listing fields for this product (2025 Etsy NLP algorithm):

Product title: ${productTitle}
Section: ${section || 'objects'}
Collection: ${collection || ''}
Movement/style: ${movement || ''}

Return a JSON object with these EXACT keys:

- "etsyTitle": Max 140 chars, target 90-120. Lead with most-searched noun phrase first 3-5 words. Natural language, no keyword stuffing. Use commas as phrase separators, NOT pipes or hyphens. Capitalize Each Word. Example: "Charizard Pokemon T-Shirt, Retro 90s Anime Graphic Tee, Fan Art Gift for Him"

- "etsyTags": Array of exactly 13 tags. Each max 20 chars including spaces. Multi-word phrases only (2-4 words). Must cover DIFFERENT search paths than the title — tags expand coverage, not repeat it. Cover: (1) character variant, (2) genre/fandom, (3) gift occasion, (4) recipient, (5) community term (otaku/weeaboo), (6) aesthetic era, (7) product fit variant. All lowercase.

- "etsyDescription": 200-300 words. Structure: (1) First 160-char hook — compressed pitch with primary keyword, what it is, who it's for, key differentiator. Never waste this on a vague intro. (2) Design description — vivid 2-3 sentences. (3) Product details — 100% cotton, DTG premium print, unisex fit, sizes S-3XL. (4) Gift hook. (5) "Machine wash cold, tumble dry low." (6) "Made to order — ships in 3-5 business days." Short paragraphs, blank lines between.

- "etsyImageAlts": Array of exactly 7 alt text strings for the 7 standard product listing images. Assume a print-on-demand t-shirt with this design. Each alt text: 100-125 chars, includes the primary keyword + describes what the image shows. Write as if the image exists. Cover these 7 angles in order: (1) front mockup on model, (2) back mockup on model, (3) close-up design detail, (4) flat lay front, (5) lifestyle/worn candid, (6) size guide or product detail shot, (7) gift/packaging context. Do NOT mention image numbers or "Image X" — write pure descriptive alt text.

Return ONLY the JSON object, no markdown, no extra text.`

  try {
    const { content, model, usage } = await callTextAI(prompt, { provider, maxTokens: 4500, temperature: 0.7 })

    const parsed = safeJsonParse(content)

    const etsyTags = Array.isArray(parsed.etsyTags)
      ? parsed.etsyTags.map(t => String(t).toLowerCase().trim().slice(0, 20)).filter(Boolean).slice(0, 13)
      : String(parsed.etsyTags || '').split(',').map(t => t.trim().toLowerCase().slice(0, 20)).filter(Boolean).slice(0, 13)

    const etsyImageAlts = Array.isArray(parsed.etsyImageAlts)
      ? parsed.etsyImageAlts.map(a => String(a).trim()).filter(Boolean).slice(0, 7)
      : []

    return res.status(200).json({
      etsyTitle:       parsed.etsyTitle       || '',
      etsyTags,
      etsyDescription: parsed.etsyDescription || '',
      etsyImageAlts,
      model,
      usage,
    })
  } catch (err) {
    console.error('[generate-etsy-listing]', err.message)
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

// Multi-ref wrapper: passes falImageUrls array to models that support it,
// falls back to single falImageUrl for the rest.
function buildMockupBodyMulti(effectiveModelId, { prompt, imageSize, falImageUrl, falImageUrls = [] }) {
  // Nano Banana /edit and GPT Image 1 edit natively support image_urls array → use all refs
  if (
    effectiveModelId === 'fal-ai/nano-banana-pro/edit' ||
    effectiveModelId === 'fal-ai/nano-banana-2/edit'   ||
    effectiveModelId === 'fal-ai/gpt-image-1/edit-image'
  ) {
    const aspect  = IMAGE_SIZE_TO_ASPECT[imageSize] || '1:1'
    const gptSize = IMAGE_SIZE_TO_GPT[imageSize]    || '1024x1024'
    if (effectiveModelId === 'fal-ai/gpt-image-1/edit-image') {
      return { prompt, image_urls: falImageUrls, image_size: gptSize, input_fidelity: 'high', quality: 'auto', num_images: 1, output_format: 'png' }
    }
    return { prompt, image_urls: falImageUrls, aspect_ratio: aspect, num_images: 1, safety_tolerance: '4' }
  }
  // All other models: delegate to single-ref builder
  return buildMockupBody(effectiveModelId, { prompt, imageSize, falImageUrl })
}

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

  // imageUrls is the multi-reference array; imageUrl is legacy single-ref fallback
  const { modelId, prompt, imageSize, imageUrl, imageUrls } = req.body || {}
  if (!prompt?.trim())            return res.status(400).json({ error: 'prompt is required' })
  if (!IMAGE_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown model: ${modelId}` })

  // Resolve ordered list of reference URLs (multi-ref: up to 4)
  const refUrls = Array.isArray(imageUrls) && imageUrls.length > 0
    ? imageUrls.slice(0, 4)
    : (imageUrl ? [imageUrl] : [])
  const primaryImageUrl = refUrls[0] || null

  // ── Direct OpenAI path (bypass fal.ai entirely) ────────────────────────────
  if (modelId === 'openai/gpt-image-1' || modelId === 'openai/gpt-image-2/edit') {
    const openAIKey = process.env.OPENAI_API_KEY
    if (!openAIKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
    const openAIModel = modelId === 'openai/gpt-image-2/edit' ? 'gpt-image-2' : 'gpt-image-1'
    try {
      const dataUrl = primaryImageUrl
        ? await callOpenAIImageEdit({ prompt: prompt.trim(), imageUrl: primaryImageUrl, imageSize, openAIKey, model: openAIModel })
        : await callOpenAIImageT2I({ prompt: prompt.trim(), imageSize, openAIKey, model: openAIModel })
      return res.status(200).json({ imageUrl: dataUrl })
    } catch (err) {
      console.error('[openai-direct]', err.message)
      return res.status(500).json({ error: err.message })
    }
  }

  const canI2I = !T2I_ONLY.has(modelId)
  const effectiveModelId = (primaryImageUrl && canI2I && T2I_TO_I2I_IMG[modelId]) ? T2I_TO_I2I_IMG[modelId] : modelId

  // Proxy all reference images to fal CDN (supports multi-ref for Nano Banana/GPT Image)
  const falImageUrls = []
  if (canI2I && refUrls.length > 0) {
    for (const u of refUrls) {
      try {
        falImageUrls.push(await proxyImageToFal(u, apiKey))
      } catch (e) {
        console.warn('[generate-mockup] proxy failed, using direct URL:', e.message)
        falImageUrls.push(u)
      }
    }
  }
  const falImageUrl = falImageUrls[0] || null

  // For models that accept image_urls array, pass all refs; others get only the first
  const body = buildMockupBodyMulti(effectiveModelId, { prompt: prompt.trim(), imageSize, falImageUrl, falImageUrls })

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

  const { action, modelId, prompt, requestId, duration, imageUrl, imageUrls } = req.body || {}
  if (!VIDEO_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown video model: ${modelId}` })
  const isWanRef = modelId === 'fal-ai/wan/v2.7/reference-to-video'

  const baseUrl   = `https://queue.fal.run/${modelId}`
  // POST requests need Content-Type; GET requests (status/result) must NOT send it —
  // some fal.ai endpoints return 405 if Content-Type appears on a GET with no body.
  const postHdrs  = { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' }
  const getHdrs   = { Authorization: `Key ${apiKey}` }
  const hdrs      = postHdrs   // legacy alias used in submit block

  try {
    if (action === 'submit') {
      if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' })

      // Proxy reference images to fal CDN so they're reachable from fal.ai model servers
      async function proxyOrFallback(url) {
        try { return await proxyImageToFal(url, apiKey) }
        catch { return url }
      }

      let falImageUrl = null
      if (imageUrl) falImageUrl = await proxyOrFallback(imageUrl)

      // For Wan 2.7 reference-to-video: proxy all refs in parallel
      let falImageUrls = []
      if (isWanRef && Array.isArray(imageUrls) && imageUrls.length > 0) {
        falImageUrls = await Promise.all(imageUrls.map(proxyOrFallback))
      } else if (falImageUrl) {
        falImageUrls = [falImageUrl]
      }

      // Kling and most fal.ai video models require duration as a string enum ("5" | "10")
      const rawDur      = parseInt(duration, 10) || 5
      const durationStr = rawDur <= 7 ? '5' : '10'

      // Derive aspect_ratio from imageSize param sent by client
      const aspectRatio = (() => {
        const s = (req.body?.imageSize || '')
        if (s.includes('portrait') || s === '9:16') return '9:16'
        if (s.includes('landscape') || s === '16:9') return '16:9'
        return '16:9'
      })()

      // Build model-specific payload
      let submitBody
      if (isWanRef) {
        // Wan 2.7 reference-to-video: accepts reference_images array for multi-ref style control
        submitBody = {
          prompt:           prompt.trim(),
          aspect_ratio:     aspectRatio,
          duration:         durationStr,
          reference_images: falImageUrls.map(url => ({ url })),
        }
      } else {
        // Kling Pro, Seedance, LTX: single start-frame image_url
        submitBody = {
          prompt:       prompt.trim(),
          duration:     durationStr,
          aspect_ratio: aspectRatio,
          ...(falImageUrl ? { image_url: falImageUrl } : {}),
        }
      }
      console.log('[generate-video] submit →', baseUrl, JSON.stringify({ ...submitBody, prompt: submitBody.prompt.slice(0, 80) }))
      const falRes = await fetch(baseUrl, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify(submitBody),
      })
      const data = await falRes.json().catch(() => null)
      if (!falRes.ok) {
        console.error('[generate-video] submit error', falRes.status, JSON.stringify(data))
        return res.status(falRes.status).json({ error: data?.detail || data?.message || `fal.ai queue error ${falRes.status}`, _debug: { submitUrl: baseUrl, falStatus: falRes.status, body: data } })
      }
      const resolvedRequestId = data.request_id ?? data.requestId ?? null
      // fal.ai returns authoritative URLs — use them directly instead of constructing
      const statusUrl   = data.status_url   ?? data.statusUrl   ?? null
      const responseUrl = data.response_url ?? data.responseUrl ?? null
      const cancelUrl   = data.cancel_url   ?? data.cancelUrl   ?? null
      console.log('[generate-video] submit ok, requestId:', resolvedRequestId, '| status_url:', statusUrl, '| raw keys:', Object.keys(data || {}))
      return res.status(200).json({ requestId: resolvedRequestId, statusUrl, responseUrl, cancelUrl })
    }

    if (action === 'status') {
      if (!requestId) return res.status(400).json({ error: 'requestId required' })

      const { statusUrl: providedStatusUrl } = req.body || {}

      // Use the URL fal.ai gave us at submit time (most reliable).
      // Fall back to constructed candidates if not provided.
      const statusUrls = providedStatusUrl
        ? [providedStatusUrl]
        : [
            `${baseUrl}/requests/${requestId}/status`,
            `https://queue.fal.run/queue/requests/${requestId}/status`,
            `https://queue.fal.run/requests/${requestId}/status`,
          ]

      let lastStatus = 0
      let lastBody   = null
      for (const url of statusUrls) {
        const falRes = await fetch(url, { headers: getHdrs })
        const body   = await falRes.json().catch(() => null)
        lastStatus   = falRes.status
        lastBody     = body
        if (falRes.ok) {
          return res.status(200).json({ status: body.status, logs: body.logs ?? [] })
        }
        console.warn(`[generate-video] status ${falRes.status} on ${url}`)
      }

      const _debug = { triedUrls: statusUrls, lastStatus, lastBody, modelId, requestId }
      console.error('[generate-video] status all failed:', JSON.stringify(_debug))
      return res.status(lastStatus || 502).json({
        error: lastBody?.detail || lastBody?.message || `Status check failed (HTTP ${lastStatus})`,
        _debug,
      })
    }

    if (action === 'result') {
      if (!requestId) return res.status(400).json({ error: 'requestId required' })

      const { responseUrl: providedResponseUrl } = req.body || {}

      const resultUrls = providedResponseUrl
        ? [providedResponseUrl]
        : [
            `${baseUrl}/requests/${requestId}`,
            `https://queue.fal.run/queue/requests/${requestId}`,
            `https://queue.fal.run/requests/${requestId}`,
          ]

      let lastStatus = 0
      let lastBody   = null
      for (const url of resultUrls) {
        const falRes = await fetch(url, { headers: getHdrs })
        const body   = await falRes.json().catch(() => null)
        lastStatus   = falRes.status
        lastBody     = body
        if (falRes.ok) {
          const videoUrl = body?.video?.url ?? body?.videos?.[0]?.url ?? null
          if (!videoUrl) return res.status(500).json({ error: 'No video URL in fal.ai response', _debug: { body } })
          return res.status(200).json({ videoUrl })
        }
        console.warn(`[generate-video] result ${falRes.status} on ${url}`)
      }

      return res.status(lastStatus || 502).json({
        error: lastBody?.detail || lastBody?.message || `Result fetch failed (HTTP ${lastStatus})`,
      })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('[generate-video]', action, err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── generate-alts — per-image alt text ───────────────────────────────────────

async function handleAlts(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { productTitle, movement, collection, images = [], provider = 'openai' } = req.body || {}
  if (!productTitle)    return res.status(400).json({ error: 'productTitle is required' })
  if (!images.length)   return res.status(400).json({ error: 'images array is empty' })

  // Extract any colour/size hints from the URL itself (Gelato URLs often embed these)
  const extractHint = url => {
    const lower = url.toLowerCase()
    const colours = ['black','white','navy','grey','gray','red','blue','green','purple','pink','yellow','brown','beige','cream','orange','teal','maroon','charcoal','heather']
    const found = colours.filter(c => lower.includes(c))
    return found.length ? `(appears to show: ${found.join(', ')})` : ''
  }

  const imageList = images
    .map((img, i) => {
      const hint = extractHint(img.url)
      return `${i + 1}. role="${img.role || 'gallery'}"  ${hint}  url="${img.url}"`
    })
    .join('\n')

  const prompt = `You are an SEO and accessibility expert for JAYL, a premium art and objects store.

Product: "${productTitle}"
Art movement/style: "${movement || 'contemporary art'}"
Collection: "${collection || ''}"

Write a UNIQUE, DISTINCT alt text for EACH image listed below.
Rules — strictly follow all of them:
- Each alt text is 1 sentence, under 120 characters
- EVERY alt text must be DIFFERENT from the others — no copy-pasting
- Use colour hints in the "appears to show" field when present (e.g. "black version", "navy colourway")
- Vary the role: hero images → describe the whole scene/composition; gallery → describe angle/detail; detail → describe close-up texture/quality
- Reference the art movement/style naturally where relevant
- Vary sentence openers: avoid starting multiple descriptions with the same word
- Useful for screen readers AND Google image search
- Do NOT write "A photo of" at the start

Images to describe:
${imageList}

Return ONLY a JSON object with key "alts" — array of objects each with "url" (exact copy from input) and "altText".
No markdown, no code fences, no explanation. Pure JSON only.`

  try {
    const { content } = await callTextAI(prompt, { provider, maxTokens: 2000, temperature: 0.6 })

    // Robust JSON extraction — handles partial responses and stray text
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      // Try extracting JSON from within the string (e.g. Longcat adds leading text)
      const match = content.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON found in response')
      parsed = JSON.parse(match[0])
    }

    const altsMap = {}
    ;(parsed.alts || []).forEach(item => {
      if (item.url && item.altText) altsMap[item.url] = String(item.altText).slice(0, 200)
    })
    const count = Object.keys(altsMap).length
    if (count === 0) throw new Error('AI returned 0 valid alt texts — try again')
    return res.status(200).json({ alts: altsMap })
  } catch (err) {
    console.error('[generate-alts]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── generate-persona ──────────────────────────────────────────────────────────

async function handlePersona(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { seed, provider = 'openai' } = req.body || {}
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
    const { content } = await callTextAI(prompt, { provider, maxTokens: 700, temperature: 0.9 })
    return res.status(200).json(JSON.parse(content))
  } catch (err) {
    console.error('[generate-persona]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── generate-social-listing ──────────────────────────────────────────────────

async function handleSocialListing(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { productTitle, section, collection, movement, provider = 'openai' } = req.body || {}
  if (!productTitle) return res.status(400).json({ error: 'productTitle is required' })

  const prompt = `You are a social media strategist for JAYL, a premium print-on-demand art and apparel brand with an edgy, cultural aesthetic.
Generate social captions and hashtags for this product:

Product title: ${productTitle}
Section: ${section || 'objects'}
Collection: ${collection || ''}
Movement/style: ${movement || ''}

Return a JSON object with these EXACT keys:

- "instagramCaption": 2-3 punchy sentences + CTA. Edgy, cultural, slightly irreverent tone — not corporate. Include 3-5 relevant hashtags inline. End with a CTA like "Link in bio 🔗" or "Shop now →".

- "pinterestCaption": 2-3 keyword-rich descriptive sentences. No hashtags. Conversational but aspirational. End with a subtle CTA. Pinterest users are planning/saving — speak to that intent.

- "tiktokCaption": 1-2 short punchy lines max 150 chars. Hook-first. Ultra casual, Gen Z tone. Use 3-5 trending TikTok hashtags. Examples of tone: "bro this just hits different 🔥", "the pokemon era is upon us 🫡". Include relevant hashtags like #fyp #foryou #anime #pokemon etc.

- "hashtags": Single string with exactly 30 Instagram/TikTok hashtags separated by spaces. Mix: 5 niche fandom tags, 5 product-type tags, 5 aesthetic/style tags, 5 gift/occasion tags, 5 broad community tags, 5 JAYL brand tags (#jaylstore #artwear #jaylart #premiumprint #wearableart). Include # on each.

Return ONLY the JSON object, no markdown, no extra text.`

  try {
    const { content, model, usage } = await callTextAI(prompt, { provider, maxTokens: 1500, temperature: 0.8 })
    const jsonStr = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    return res.status(200).json({
      instagramCaption: parsed.instagramCaption || '',
      pinterestCaption: parsed.pinterestCaption || '',
      tiktokCaption:    parsed.tiktokCaption    || '',
      hashtags:         parsed.hashtags         || '',
      model,
      usage,
    })
  } catch (err) {
    console.error('[generate-social-listing]', err.message)
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
  if (h === 'listing')        return handleListing(req, res)
  if (h === 'etsy-listing')   return handleEtsyListing(req, res)
  if (h === 'social-listing') return handleSocialListing(req, res)
  if (h === 'mockup')       return handleMockup(req, res)
  if (h === 'video')        return handleVideo(req, res)
  if (h === 'persona')      return handlePersona(req, res)
  if (h === 'alts')         return handleAlts(req, res)

  return res.status(404).json({ error: `Unknown AI handler: ${h}` })
}
