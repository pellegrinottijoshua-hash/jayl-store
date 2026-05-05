/**
 * Proxies any image URL to fal.ai CDN storage.
 *
 * Why: fal.ai model servers must be able to reach the image_url you send them.
 * Gelato CDN, GitHub raw, and production Vercel URLs are publicly reachable,
 * but localhost dev URLs are not. Uploading to fal CDN guarantees accessibility
 * from all fal.ai model servers regardless of source URL.
 *
 * Flow:
 *   1. Fetch image bytes from source URL (in our serverless function)
 *   2. Initiate upload → fal returns a signed PUT URL + final CDN URL
 *   3. PUT bytes to signed URL
 *   4. Return final CDN URL for use in generation requests
 */

const FAL_REST = 'https://rest.alpha.fal.ai'

/**
 * @param {string} imageUrl   - Source URL (http/https, publicly accessible or localhost)
 * @param {string} apiKey     - FAL_KEY
 * @returns {Promise<string>} - fal.ai CDN URL (always reachable by fal.ai models)
 */
export async function proxyImageToFal(imageUrl, apiKey) {
  // Skip localhost — our serverless function can't reach them either
  if (!imageUrl || imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
    throw new Error('Cannot proxy localhost image URLs — use a public image or upload to Gelato first')
  }

  // 1. Fetch source image
  const imgRes = await fetch(imageUrl, {
    headers: { 'User-Agent': 'JAYL-Store/1.0' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!imgRes.ok) {
    throw new Error(`Cannot fetch reference image (HTTP ${imgRes.status}): ${imageUrl.slice(0, 80)}`)
  }
  const imageBytes  = await imgRes.arrayBuffer()
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  const ext         = contentType.includes('png') ? 'png'
                    : contentType.includes('webp') ? 'webp'
                    : 'jpg'

  // 2. Initiate upload — fal returns { upload_url, file_url }
  const initiateRes = await fetch(
    `${FAL_REST}/storage/upload/initiate?storage_type=fal-cdn-v3`,
    {
      method:  'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content_type: contentType, file_name: `ref-mockup.${ext}` }),
    }
  )
  if (!initiateRes.ok) {
    const err = await initiateRes.json().catch(() => ({}))
    throw new Error(`fal storage initiate failed (${initiateRes.status}): ${err.message || 'unknown'}`)
  }
  const { upload_url, file_url } = await initiateRes.json()
  if (!upload_url || !file_url) throw new Error('fal storage initiate returned unexpected payload')

  // 3. Upload bytes via signed PUT
  const putRes = await fetch(upload_url, {
    method:  'PUT',
    headers: { 'Content-Type': contentType },
    body:    imageBytes,
  })
  if (!putRes.ok) throw new Error(`fal storage PUT failed (${putRes.status})`)

  return file_url   // e.g. https://v3.fal.media/files/...
}
