import { useEffect } from 'react'

const SITE_NAME  = 'JAYL'
const BASE_TITLE = 'JAYL — Premium Art & Wearable Art'
const BASE_DESC  = 'Premium print-on-demand art and streetwear. AI-reinterpreted art movements, contemporary subjects.'
const BASE_IMAGE = 'https://jayl-store.vercel.app/og-default.jpg'  // fallback og image

function setMeta(name, content, isProp = false) {
  if (!content) return
  const attr    = isProp ? 'property' : 'name'
  let   el      = document.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * usePageMeta — updates <title> and social meta tags.
 *
 * @param {Object} opts
 * @param {string}  opts.title       — Full page title (no suffix needed)
 * @param {string}  opts.description — Page description
 * @param {string}  [opts.image]     — Absolute URL of og:image
 * @param {string}  [opts.url]       — Canonical URL (defaults to window.location.href)
 * @param {string}  [opts.type]      — og:type (default: 'website')
 */
export function usePageMeta({ title, description, image, url, type = 'website' } = {}) {
  useEffect(() => {
    const prevTitle = document.title

    const resolvedTitle = title       || BASE_TITLE
    const resolvedDesc  = description || BASE_DESC
    const resolvedImg   = image       || BASE_IMAGE
    const resolvedUrl   = url         || window.location.href
    const fullTitle     = title ? `${title} — ${SITE_NAME}` : BASE_TITLE

    document.title = fullTitle

    // Standard
    setMeta('description', resolvedDesc)

    // Open Graph
    setMeta('og:site_name',   SITE_NAME, true)
    setMeta('og:type',        type,      true)
    setMeta('og:title',       fullTitle, true)
    setMeta('og:description', resolvedDesc, true)
    setMeta('og:image',       resolvedImg,  true)
    setMeta('og:url',         resolvedUrl,  true)

    // Twitter / X
    setMeta('twitter:card',        'summary_large_image')
    setMeta('twitter:title',       fullTitle)
    setMeta('twitter:description', resolvedDesc)
    setMeta('twitter:image',       resolvedImg)

    return () => {
      document.title = prevTitle
    }
  }, [title, description, image, url, type])
}
