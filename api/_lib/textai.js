// Helper di testo AI condivisi fra api/ai.js e api/publish-social.js (testi
// social). Spostati qui da api/ai.js senza modifiche: provider, chiamata,
// parsing JSON tollerante e brief anti-ripetizione.

export const AI_PROVIDERS = {
  'openai':            { baseUrl: 'https://api.openai.com',              model: 'gpt-4o-mini',               keyEnv: 'OPENAI_API_KEY' },
  'longcat-flash':     { baseUrl: 'https://api.longcat.chat/openai',     model: 'LongCat-Flash-Chat',        keyEnv: 'LONGCAT_API_KEY' },
  'longcat-thinking':  { baseUrl: 'https://api.longcat.chat/openai',     model: 'LongCat-Flash-Thinking',    keyEnv: 'LONGCAT_API_KEY' },
}

export async function callTextAI(prompt, { provider = 'openai', maxTokens = 1400, temperature = 0.7, jsonMode = true, frequencyPenalty = 0, presencePenalty = 0 } = {}) {
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
    // Repetition controls — push gpt-4o-mini away from formulaic, near-identical copy.
    ...(frequencyPenalty ? { frequency_penalty: frequencyPenalty } : {}),
    ...(presencePenalty  ? { presence_penalty:  presencePenalty  } : {}),
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
export function safeJsonParse(content) {
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

// ── Anti-repetition helpers ───────────────────────────────────────────────────
// gpt-4o-mini left to its own devices writes near-identical "generic POD" copy.
// We force divergence per call by (a) penalties in callTextAI, (b) injecting a
// randomly-rotated creative brief so each listing is pushed in a fresh direction.
export const pick = arr => arr[Math.floor(Math.random() * arr.length)]

export const CREATIVE_VOICES = [
  'wry and deadpan, like a friend who is too cool to try hard',
  'hyped collector energy — this is a grail and you know it',
  'nostalgic 90s-kid warmth, Saturday-morning-cartoon feels',
  'streetwear hype-beast, drop-culture confidence',
  'cozy and wholesome, soft and a little tender',
  'bold and rebellious, anti-establishment edge',
  'minimalist and understated — let the art do the talking',
  'playful and meme-aware without trying too hard',
  'cinematic and a touch dramatic, like a movie trailer',
  'confident gift-guide expert who knows exactly who this is for',
]

export const DESC_OPENERS = [
  'open mid-scene, describing the character in motion or mood',
  'open with a sharp, specific statement about the character\'s personality',
  'open by naming the exact person/occasion this is the perfect gift for',
  'open with a vivid sensory detail of the artwork itself',
  'open with a cultural reference or in-joke real fans will get',
  'open with the feeling someone gets wearing it',
]

// Overused print-on-demand phrasings the model must avoid — keeps copy from
// collapsing back to the same template every time.
export const BANNED_POD_PHRASES = [
  'perfect for any fan', 'ideal for', 'whether you', 'look no further',
  'unleash', 'embrace', 'elevate your', 'step up your', 'level up',
  'show off', 'make a statement', 'turn heads', 'must-have', 'one of a kind',
  'crafted with care', 'high-quality', 'sure to', 'this stunning', 'this amazing',
]

// Returns a per-call creative brief block to splice into a prompt.
export function creativeBrief({ etsy = false } = {}) {
  const seed = Math.floor(Math.random() * 1e9)
  return `CREATIVE BRIEF (unique to THIS listing — do not reuse phrasing from any other listing):
- Voice for this one: ${pick(CREATIVE_VOICES)}
- For the main description, ${pick(DESC_OPENERS)}.
${etsy ? `- For the Etsy description hook, ${pick(DESC_OPENERS)} — and make the FIRST line feel handwritten, not templated.\n` : ''}- Variation seed: ${seed} — treat as an instruction to take a genuinely fresh, non-templated approach versus a typical listing.
- BANNED phrases (never use, in any field): ${BANNED_POD_PHRASES.join(', ')}.`
}

// Calls the model, parses JSON, and on failure retries ONCE with a strict-JSON
// repair instruction. Centralises robustness so a single malformed response
// (unescaped quote, missing comma) no longer 500s the whole request.
export async function callTextAIJson(prompt, opts = {}) {
  const first = await callTextAI(prompt, opts)
  try {
    return { parsed: safeJsonParse(first.content), model: first.model, usage: first.usage }
  } catch (_) {
    const repairPrompt = `${prompt}

IMPORTANT: Your previous answer was not valid JSON. Return STRICTLY valid, minified JSON only.
Escape every double-quote that appears inside a string value (use \\"). Do not use smart/curly quotes.
No markdown, no code fences, no commentary — JSON object only.`
    const retry = await callTextAI(repairPrompt, { ...opts, temperature: 0.2 })
    return { parsed: safeJsonParse(retry.content), model: retry.model, usage: retry.usage }
  }
}
