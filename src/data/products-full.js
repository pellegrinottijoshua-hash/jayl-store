// Full, unstripped catalog — admin panel only.
//
// The storefront imports `./products.js`, which is fed a build-time-stripped copy
// of the catalog (see the `storefrontProducts` plugin in vite.config.js): roughly
// a third of admin-products.js is Etsy/Pinterest/Gelato bookkeeping that shoppers
// never see, and shipping it in the main bundle cost every visitor ~280 kB.
//
// The admin editors *do* need those fields, so they import from here. Both admin
// pages are lazy-loaded, so the full catalog lands in the admin chunk and stays
// out of the storefront's critical path.
import { adminProducts } from './admin-products.js'

export const products = [...adminProducts]

export const getProductById = (id) => products.find((p) => p.id === id)
