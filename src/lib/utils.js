import { clsx } from 'clsx'

export function cn(...inputs) {
  return clsx(inputs)
}

/**
 * Format cents to a locale currency string
 * e.g. 8900 → "$89.00"
 */
export function formatPrice(cents, currency = 'eur') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert a kebab-case slug to a title
 * e.g. "art-nouveau" → "Art Nouveau"
 */
export function slugToTitle(slug) {
  if (!slug) return ''
  return slug
    .split('-')
    .map(capitalize)
    .join(' ')
}

/**
 * Clamp a number between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Returns true if a product was added within the last N days
 * (requires product.createdAt ISO string — only admin-added products have it)
 */
export function isNewProduct(product, daysThreshold = 14) {
  if (!product?.createdAt) return false
  const diffMs = Date.now() - new Date(product.createdAt).getTime()
  return diffMs / (1000 * 60 * 60 * 24) <= daysThreshold
}

/**
 * Convert a string to a URL-safe slug
 * e.g. "Expressionist Landscapes" → "expressionist-landscapes"
 */
export function toSlug(str) {
  return (str ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
