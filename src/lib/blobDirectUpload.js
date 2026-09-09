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
// reads it back with blobGet + BLOB_READ_WRITE_TOKEN. See api/_lib blobToBase64,
// which now deletes the blob in a `finally` — not only on the success path — so
// a re-upload of the SAME pathname (see allowOverwrite below) never meets a
// blob orphaned by a server-side failure.
//
// ── allowOverwrite ───────────────────────────────────────────────────────────
// Every caller here uses a DETERMINISTIC pathname (`<productId>/<filename>`,
// `designs/<id>/<filename>`) — a re-upload of the same file for the same
// product is meant to replace what's there, not fail. Without it, Vercel Blob
// rejects a PUT to an existing pathname with 400 "This blob already exists" —
// and the blob normally never survives past the request that reads it (the
// server deletes it right after), so under normal operation this collision
// cannot happen. It DID happen once: the server-side commit for Entei's
// 13.8 MB print file failed mid-request (the site was mid-incident from the
// admin-products.js catalog bug at the same time), the blob was never read,
// so it was never deleted — and every retry with the same filename hit the
// same 400 forever after, because the orphan had nothing that would ever
// clean it up. `allowOverwrite` makes a retry succeed instead of getting
// permanently stuck on its own leftover.
//
// THE PERMISSION LIVES ON THE TOKEN, NOT ON THE REQUEST (found 2026-09-09)
// This used to travel as an `x-allow-overwrite: 1` header on the PUT below.
// It broke silently: Vercel Blob's CORS preflight for blob.vercel-storage.com
// stopped listing that header in Access-Control-Allow-Headers, so every PUT
// failed the browser's preflight check before the request ever left the
// tab — surfacing here only as a bare, undiagnosable `xhr.onerror`, with the
// real reason ("Request header field x-allow-overwrite is not allowed by
// Access-Control-Allow-Headers in preflight response") visible only in the
// browser console, never in anything this file could catch or report.
// `allowOverwrite: true` now lives server-side, baked into the signed
// clientToken by onBeforeGenerateToken (see api/admin.js) — nothing on this
// end needs to ask for the permission at request time anymore.

const BLOB_API = 'https://blob.vercel-storage.com'

// Marks a rejection as a transport-layer failure (xhr.onerror/ontimeout — the
// PUT never reached the server, so nothing was written and retrying the exact
// same request is safe) as opposed to a real Blob rejection (bad pathname,
// size cap, "already exists" from a stuck orphan) which retrying verbatim
// would just repeat forever.
class NetworkLayerError extends Error {}

function putOnce(pathname, file, clientToken, { onProgress, signal } = {}) {
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
    xhr.onerror   = () => reject(new NetworkLayerError('Errore di rete durante l\'upload su Blob'))
    xhr.ontimeout = () => reject(new NetworkLayerError('Timeout di rete durante l\'upload su Blob'))
    xhr.onabort   = () => reject(new Error('Upload annullato'))

    if (signal) {
      if (signal.aborted) return reject(new Error('Upload annullato'))
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(file)
  })
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

/**
 * @param {string} pathname     target name inside the blob store
 * @param {File|Blob} file
 * @param {object} opts
 * @param {string} opts.clientPayload  JSON string forwarded to the token endpoint
 * @param {(pct:number)=>void} [opts.onProgress]  0-100, real upload progress
 * @param {AbortSignal} [opts.signal]
 * @param {number} [opts.maxNetworkRetries]  retries for onerror/ontimeout only (default 2)
 * @returns {Promise<{url:string, pathname:string}>}
 */
export async function blobDirectUpload(pathname, file, { clientPayload, onProgress, signal, maxNetworkRetries = 2 } = {}) {
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
  //
  // A bare xhr.onerror carries no status code and no response body — the
  // browser refused or lost the connection before the server ever answered
  // (a WiFi hiccup mid-transfer on a multi-MB macro photo is the common case
  // here). That is retriable: the request never landed, so nothing was
  // written server-side and re-sending the same bytes is safe. A real Blob
  // rejection (bad pathname, size cap, an actual "already exists") comes back
  // through xhr.onload with a status code instead, and is NOT retried here —
  // retrying that verbatim would just fail the same way forever.
  let attempt = 0
  for (;;) {
    try {
      return await putOnce(pathname, file, clientToken, { onProgress, signal })
    } catch (e) {
      if (!(e instanceof NetworkLayerError) || attempt >= maxNetworkRetries || signal?.aborted) throw e
      attempt++
      if (onProgress) onProgress(0)
      await sleep(attempt * 1000) // 1s, then 2s
    }
  }
}
