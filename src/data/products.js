// Product catalog for JAYL store
// v1 LAUNCH: only real Gelato products from the admin panel are shown.
// Static sample products (art prints + streetwear) are preserved in
// src/data/products-samples.js — HIDDEN until the Art launch.
// To re-enable: import sampleProducts from './products-samples.js' and
// change: export const products = [...sampleProducts, ...adminProducts]
// Storefront catalog. The import is rewritten at build time to a stripped copy of
// admin-products.js with the admin-only fields removed (see the `storefrontProducts`
// plugin in vite.config.js). Admin editors need the full records — they import
// './products-full.js' instead. Under plain Node (api/*) this resolves to the real
// module, so server code always sees everything.
import { adminProducts } from 'virtual:storefront-products'

export const MOVEMENTS = [
  'impressionism',
  'surrealism',
  'cubism',
  'expressionism',
  'art-nouveau',
  'bauhaus',
]

export const SUBJECTS = [
  'technology',
  'ai',
  'urban-life',
  'digital-culture',
  'social-media',
  'late-capitalism',
]

// HIDDEN - re-enable for Art launch (merge with sampleProducts)
export const products = [...adminProducts]

export const getFeaturedProducts  = () => products.filter((p) => p.featured)
export const getProductsBySection = (section) => products.filter((p) => p.section === section)
export const getProductById       = (id) => products.find((p) => p.id === id)
