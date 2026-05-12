// Product catalog for JAYL store
// v1 LAUNCH: only real Gelato products from the admin panel are shown.
// Static sample products (art prints + streetwear) are preserved in
// src/data/products-samples.js — HIDDEN until the Art launch.
// To re-enable: import sampleProducts from './products-samples.js' and
// change: export const products = [...sampleProducts, ...adminProducts]
import { adminProducts } from './admin-products.js'

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
