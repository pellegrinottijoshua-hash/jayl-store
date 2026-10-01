// Stato della pubblicazione social (pool dei testi, storico, impostazioni) in
// src/data/social.json, letto e scritto via GitHub. I commit portano
// `[skip ci]` come quelli di vendite e carrelli: lo legge solo il server,
// quindi non serve un deploy a ogni pubblicazione.

import { ghGet, ghPut, ghTreePaths } from './github.js'
import { emptySocial } from '../../src/lib/socialPool.js'

export const SOCIAL_PATH = 'src/data/social.json'

export async function readSocial(token) {
  try {
    const file = await ghGet(SOCIAL_PATH, token)
    const parsed = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))
    return { state: { ...emptySocial(), ...parsed }, sha: file.sha }
  } catch (e) {
    if (/: 404$/.test(e.message)) return { state: emptySocial(), sha: null }
    throw e
  }
}

/**
 * Rilegge, applica `mutate` (funzione pura sullo stato) e scrive. Se nel
 * frattempo qualcun altro ha scritto (sha cambiato), ci riprova una volta
 * sullo stato nuovo invece di sovrascriverlo.
 */
export async function updateSocial(token, mutate, message) {
  for (let attempt = 0; ; attempt++) {
    const { state, sha } = await readSocial(token)
    const next = mutate(state)
    try {
      await ghPut(SOCIAL_PATH, JSON.stringify(next, null, 1) + '\n', sha, `${message} [skip ci]`, token)
      return next
    } catch (e) {
      if (attempt === 0 && /GitHub PUT [^:]+: (409|422)\b/.test(e.message)) continue
      throw e
    }
  }
}

/** { [productId]: [nome file relativo alla cartella] } da public/images/<id>/… */
export async function listProductFiles(token) {
  const out = {}
  for (const p of await ghTreePaths(token)) {
    const m = p.match(/^public\/images\/([^/]+)\/(.+)$/)
    if (!m) continue
    const [, productId, rest] = m
    // Solo file diretti e la sottocartella generated/, come alla build.
    if (rest.includes('/') && !/^generated\/[^/]+$/.test(rest)) continue
    ;(out[productId] ??= []).push(rest)
  }
  return out
}
