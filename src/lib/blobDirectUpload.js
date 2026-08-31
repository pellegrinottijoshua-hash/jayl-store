// Direct upload to Vercel Blob, without @vercel/blob/client's `upload()`.
//
// WHY NOT THE SDK
// `upload()` hangs indefinitely against this store: the progress callback never
// fires (stuck at 0%), the promise neither resolves nor rejects, so no catch and
// no AbortSignal can recover it. The same two HTTP calls issued directly return
// 200 in under two seconds for an 8.6 MB print file.
//
// THE PROTOCOL (verified against production, not guessed)
//   1. POST /api/admin  {type:'blob.generate-client-token', payload:{pathname,…}}
//        → { clientToken }
//   2. PUT https://blob.vercel-storage.com/?pathname=<urlencoded>
//        headers: authorization: Bearer <clientToken>
//                 x-api-version: 11
//                 x-vercel-blob-access: private   ← the store is private; omitting
//                   this yields "Cannot use public access on a private store"
//        → { url, downloadUrl, pathname, … }
//
// The pathname travels as a QUERY PARAMETER. Putting it in the URL path returns
// "Invalid pathname" — that detail costs an afternoon if you assume otherwise.
//
// The resulting url is NOT publicly readable (403 without a token): the server
// reads it back with blobGet + BLOB_READ_WRITE_TOKEN. See api/_lib blobToBase64.

const BLOB_API = 'https://blob.vercel-storage.com'

/**
 * @param {string} pathname     target name inside the blob store
 * @param {File|Blob} file
 * @param {object} opts
 * @param {string} opts.clientPayload  JSON string forwarded to the token endpoint
 * @param {(pct:number)=>void} [opts.onProgress]  0-100, real upload progress
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{url:string, pathname:string}>}
 */
export async function blobDirectUpload(pathname, file, { clientPayload, onProgress, signal } = {}) {
  // ── 1. token ──────────────────────────────────────────────────────────────
  const tokenRes = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname, clientPayload, multipart: false },
    }),
    signal,
  })
  if (!tokenRes.ok) {
    const msg = await tokenRes.text().catch(() => '')
    throw new Error(`Token Blob rifiutato (${tokenRes.status}) ${msg.slice(0, 120)}`)
  }
  const { clientToken, error } = await tokenRes.json()
  if (!clientToken) throw new Error(`Token Blob assente${error ? `: ${error}` : ''}`)

  // ── 2. PUT the bytes ──────────────────────────────────────────────────────
  // XMLHttpRequest rather than fetch: browsers still expose upload progress only
  // through XHR, and progress is the difference between a diagnosable stall and
  // a mystery.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `${BLOB_API}/?pathname=${encodeURIComponent(pathname)}`, true)
    xhr.setRequestHeader('authorization', `Bearer ${clientToken}`)
    xhr.setRequestHeader('x-api-version', '11')
    xhr.setRequestHeader('x-vercel-blob-access', 'private')
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText)
          if (!body.url) return reject(new Error('Blob non ha restituito un url'))
          resolve(body)
        } catch {
          reject(new Error('Risposta Blob illeggibile'))
        }
      } else {
        let detail = xhr.responseText?.slice(0, 200) || ''
        try { detail = JSON.parse(xhr.responseText)?.error?.message || detail } catch { /* raw text */ }
        reject(new Error(`Blob ha rifiutato l'upload (${xhr.status}): ${detail}`))
      }
    }
    xhr.onerror   = () => reject(new Error('Errore di rete durante l\'upload su Blob'))
    xhr.ontimeout = () => reject(new Error('Timeout di rete durante l\'upload su Blob'))
    xhr.onabort   = () => reject(new Error('Upload annullato'))

    if (signal) {
      if (signal.aborted) return reject(new Error('Upload annullato'))
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(file)
  })
}
