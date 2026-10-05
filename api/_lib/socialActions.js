// Azioni della pubblicazione rapida, chiamate da api/publish-social.js
// (POST con la password admin e `action`) — dall'admin e da un agente.
// Spec: docs/superpowers/specs/2026-09-30-social-publish-design.md
//
// Tutto ciò che parla col mondo (GitHub, social, AI, il sito) arriva da
// `deps`, così le regole qui sotto si testano senza rete
// (scripts/test-social-actions.js):
//   products     catalogo completo (admin-products.js)
//   siteUrl      https://www.jayl.store
//   store        { read() → { state }, update(mutate, message) → state }
//   generate     ({ product, platform, count, avoid }) → [{ title, text, tags }]
//   urlExists    (url) → boolean
//   status       ({ settings }) → { platforms: { [key]: { mode, detail } }, … }
//   adapters     { [platform]: ({ format, mediaType, mediaUrl, caption, text, link, settings }) → { id, url } }
//   listAssets   () → { [productId]: [nome file relativo alla cartella] }

import { PLATFORMS, platformOf, formatsFor, usesCaption, composeText, productLink } from '../../src/lib/socialPlatforms.js'
import { nextCaption, unusedCount, addCaptions, markUsed } from '../../src/lib/socialPool.js'
import { isSocialAsset, mediaTypeOf } from '../../src/lib/socialAssets.js'
import { optimizedPath } from '../../src/lib/optimizedImage.js'

const REFILL = 5

const reply = (status, json) => ({ status, json })
const fail = (status, error) => reply(status, { ok: false, error })

/** Valida prodotto, social, asset e formato. Ritorna i dati o una risposta d'errore. */
function validate(body, deps, { needsFormat = true } = {}) {
  const { productId, platform, asset, format } = body
  const product = deps.products.find((p) => p.id === productId)
  if (!product) return { error: fail(404, `Prodotto sconosciuto: ${productId}`) }
  if (!platformOf(platform)) return { error: fail(400, `Social sconosciuto: ${platform}`) }
  if (asset === undefined && !needsFormat) return { product }

  const prefix = `/images/${productId}/`
  const rest = typeof asset === 'string' && asset.startsWith(prefix) ? asset.slice(prefix.length) : null
  if (!rest || rest.includes('..') || /[?#\\]/.test(rest) || !isSocialAsset(decodeURIComponent(rest))) {
    return { error: fail(400, `Asset non valido per ${productId}: ${asset}`) }
  }
  const mediaType = mediaTypeOf(rest)
  if (needsFormat && !formatsFor(platform, mediaType).includes(format)) {
    return { error: fail(400, `${platformOf(platform).label} non accetta "${format}" per un ${mediaType === 'video' ? 'video' : 'immagine'}`) }
  }
  return { product, mediaType }
}

/** Testi già scritti per prodotto e social: il generatore deve evitarli. */
const writtenTexts = (state, productId, platform) =>
  (state.captions?.[productId]?.[platform] || []).slice(-15).map((c) => c.text.slice(0, 120))

/** Il prossimo testo non usato, rifornendo il pool se è vuoto. */
async function ensureCaption(deps, product, platform, after = null) {
  let { state } = await deps.store.read()
  let caption = nextCaption(state, product.id, platform, after)
  if (caption) return { caption, state }

  const pool = state.captions?.[product.id]?.[platform] || []
  const seeds = platform === 'pinterest' && pool.length === 0
    ? (product.pinterestPins || []).filter((p) => !p.published && p.description)
        .map((p) => ({ title: p.title, text: p.description, tags: p.tags }))
    : []
  const fresh = seeds.length
    ? seeds
    : await deps.generate({ product, platform, count: REFILL, avoid: writtenTexts(state, product.id, platform) })
  state = await deps.store.update(
    (s) => addCaptions(s, product.id, platform, fresh),
    `[social] ${fresh.length} testi ${platform} per ${product.id}`,
  )
  caption = nextCaption(state, product.id, platform, after)
  return { caption, state }
}

async function publish(body, deps) {
  const v = validate(body, deps)
  if (v.error) return v.error
  const { product, mediaType } = v
  const { platform, format, asset } = body

  const { state } = await deps.store.read()
  const status = await deps.status({ settings: state.settings || {} })
  const adapter = deps.adapters[platform]
  if (!adapter || status.platforms?.[platform]?.mode !== 'api') {
    return fail(409, `${platformOf(platform).label} non è collegato: usa "Apri e copia"`)
  }

  let caption = null
  if (usesCaption(format)) {
    if (body.captionId) {
      caption = (state.captions?.[product.id]?.[platform] || []).find((c) => c.id === body.captionId) || null
      if (!caption) return fail(400, 'Testo non trovato nel pool')
      if (caption.usedAt) return fail(409, 'Questo testo è già stato usato: pesca il prossimo')
    } else {
      caption = (await ensureCaption(deps, product, platform)).caption
      if (!caption) return fail(500, 'Nessun testo disponibile')
    }
  }

  // Immagini: la versione JPEG generata alla build (Instagram accetta solo
  // JPEG, e pesa meno anche per gli altri). Se non c'è ancora, Instagram
  // deve aspettare il deploy; gli altri usano l'originale.
  let mediaUrl = `${deps.siteUrl}${asset}`
  if (mediaType === 'image') {
    const jpg = `${deps.siteUrl}${optimizedPath(asset, 'ig')}`
    if (await deps.urlExists(jpg)) mediaUrl = jpg
    else if (platform === 'instagram') return fail(409, 'La versione JPEG di questa foto non è ancora online: aspetta che finisca il deploy e riprova')
  }

  let result
  try {
    result = await adapter({
      format, mediaType, mediaUrl, caption,
      text: caption ? composeText(platform, caption) : '',
      link: productLink(product.id, platform, format),
      settings: state.settings || {},
    })
  } catch (e) {
    return fail(502, e.message || String(e))
  }

  const next = await deps.store.update(
    (s) => markUsed(s, {
      productId: product.id, platform, format, captionId: caption?.id ?? null, asset,
      mode: 'api', postId: result?.id ?? null, url: result?.url ?? null,
    }),
    `[social] ${platform} ${format} ${product.id}`,
  )
  return reply(200, { ok: true, result, caption, unused: unusedCount(next, product.id, platform) })
}

export async function handleSocialAction(body, deps) {
  switch (body?.action) {
    case 'status': {
      const { state } = await deps.store.read()
      return reply(200, await deps.status({ settings: state.settings || {} }))
    }

    case 'state': {
      const { state } = await deps.store.read()
      const captions = {}
      for (const [productId, byPlatform] of Object.entries(state.captions || {})) {
        captions[productId] = {}
        for (const platform of Object.keys(byPlatform)) {
          captions[productId][platform] = {
            unused: unusedCount(state, productId, platform),
            next: nextCaption(state, productId, platform),
          }
        }
      }
      // Asset gia' usciti: { productId: { asset: [social…] } }, dallo storico intero.
      const posted = {}
      for (const e of state.log || []) {
        if (!e.asset || !e.platform) continue
        const byAsset = (posted[e.productId] ||= {})
        const list = (byAsset[e.asset] ||= [])
        if (!list.includes(e.platform)) list.push(e.platform)
      }
      return reply(200, { captions, posted, log: (state.log || []).slice(-30).reverse(), settings: state.settings || {} })
    }

    case 'caption': {
      const v = validate(body, deps, { needsFormat: false })
      if (v.error) return v.error
      try {
        const { caption, state } = await ensureCaption(deps, v.product, body.platform, body.after || null)
        return reply(200, { ok: true, caption, unused: unusedCount(state, v.product.id, body.platform) })
      } catch (e) {
        return fail(502, `Testi non generati: ${e.message || e}`)
      }
    }

    case 'publish':
      return publish(body, deps)

    case 'mark-used': {
      const v = validate(body, deps)
      if (v.error) return v.error
      const next = await deps.store.update(
        (s) => markUsed(s, {
          productId: body.productId, platform: body.platform, format: body.format,
          captionId: body.captionId || null, asset: body.asset, mode: 'manual',
        }),
        `[social] ${body.platform} ${body.format} ${body.productId} (manuale)`,
      )
      return reply(200, { ok: true, unused: unusedCount(next, body.productId, body.platform) })
    }

    // Toglie il segno "gia' pubblicato" (asset + social) dallo storico.
    case 'unmark-used': {
      const v = validate(body, deps, { needsFormat: false })
      if (v.error) return v.error
      await deps.store.update(
        (s) => ({ ...s, log: (s.log || []).filter((e) => !(e.productId === body.productId && e.platform === body.platform && e.asset === body.asset)) }),
        `[social] ${body.platform} ${body.productId}: tolto segno pubblicato`,
      )
      return reply(200, { ok: true })
    }

    case 'settings': {
      const patch = {}
      if ('pinterestBoardId' in body) patch.pinterestBoardId = body.pinterestBoardId ? String(body.pinterestBoardId) : null
      const next = await deps.store.update((s) => ({ ...s, settings: { ...(s.settings || {}), ...patch } }), '[social] impostazioni')
      return reply(200, { ok: true, settings: next.settings })
    }

    case 'assets': {
      const [{ state }, files] = await Promise.all([deps.store.read(), deps.listAssets()])
      const products = []
      for (const product of deps.products) {
        const names = (files[product.id] || []).filter(isSocialAsset)
          .sort((a, b) => (mediaTypeOf(b) === 'video') - (mediaTypeOf(a) === 'video') || a.localeCompare(b))
        if (!names.length) continue
        products.push({
          productId: product.id,
          name: product.name,
          assets: names.map((n) => ({ src: `/images/${product.id}/${n}`, type: mediaTypeOf(n) })),
          unused: Object.fromEntries(PLATFORMS.map((p) => [p.key, unusedCount(state, product.id, p.key)])),
        })
      }
      return reply(200, { ok: true, products })
    }

    default:
      return fail(400, `Azione sconosciuta: ${body?.action}`)
  }
}
