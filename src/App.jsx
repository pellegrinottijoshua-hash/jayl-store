import { Routes, Route, Navigate, Link, useLocation, useParams } from 'react-router-dom'
import { useLayoutEffect, useEffect, lazy, Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CartDrawer from '@/components/cart/CartDrawer'
import ZackNavbar from '@/components/zack/ZackNavbar'
import ZackFooter from '@/components/zack/ZackFooter'
import ZackHomePage from '@/pages/ZackHomePage'
import { getProductById } from '@/data/products'
import { worldFor, ZACK, SITE, crossSiteUrl } from '@/lib/world'
// Eager: the pages on the browse-to-buy path. Anything a first-time visitor is
// likely to hit before deciding, so no chunk waterfall where it hurts.
import HomePage from '@/pages/HomePage'
import ArtPage from '@/pages/ArtPage'
import ObjectsPage from '@/pages/ObjectsPage'
import ProductPage from '@/pages/ProductPage'
import CollectionPage from '@/pages/CollectionPage'
import CookieBanner from '@/components/CookieBanner'
import { useThemeStore } from '@/store/themeStore'

// Admin panel is owner-only + heavy (generate-assets, big editors) — lazy-load it
// so its code and deps stay OUT of the storefront's main bundle.
const AdminPage        = lazy(() => import('@/pages/AdminPage'))
const AdminProductPage = lazy(() => import('@/pages/AdminProductPage'))

// Checkout drags in the whole Stripe SDK — nobody pays before they browse.
const CheckoutPage          = lazy(() => import('@/pages/CheckoutPage'))
const OrderConfirmationPage = lazy(() => import('@/pages/OrderConfirmationPage'))

// Long-tail pages: reached from the footer or a link, never on the critical path.
const ArtistPage     = lazy(() => import('@/pages/ArtistPage'))
const WishlistPage   = lazy(() => import('@/pages/WishlistPage'))
const TrackPage      = lazy(() => import('@/pages/TrackPage'))
const AmbassadorPage = lazy(() => import('@/pages/AmbassadorPage'))
const ContactPage    = lazy(() => import('@/pages/ContactPage'))
const ShippingPage   = lazy(() => import('@/pages/ShippingPage'))
const ReturnsPage    = lazy(() => import('@/pages/ReturnsPage'))
const TermsPage      = lazy(() => import('@/pages/TermsPage'))
const PrivacyPage    = lazy(() => import('@/pages/PrivacyPage'))
const CookiesPage    = lazy(() => import('@/pages/CookiesPage'))

/** Fire a GA4 page_view only when analytics consent has been granted. */
function useGA4PageTracking() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', {
      page_path:     pathname,
      page_location: window.location.href,
    })
  }, [pathname])
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    // Prevent the browser from restoring the previous scroll position.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    // Override smooth-scroll so the jump is instant, not animated.
    const html = document.documentElement
    html.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    // Restore smooth-scroll after the browser has painted.
    requestAnimationFrame(() => {
      html.style.scrollBehavior = ''
    })
  }, [pathname])
  return null
}

// Mirrors the persisted site theme onto <html data-site-theme>, which flips the
// palette tokens in index.css. Never on /admin: the panel is built on the same
// tokens and stays dark.
// Nel mondo Zack mai: la sua palette e' fissa (nero, panna, oro).
function useSiteThemeAttribute(skip) {
  const siteTheme = useThemeStore((s) => s.siteTheme)
  useLayoutEffect(() => {
    const html = document.documentElement
    if (siteTheme === 'cream' && !skip) html.setAttribute('data-site-theme', 'cream')
    else html.removeAttribute('data-site-theme')
  }, [siteTheme, skip])
}

// Una scheda nuova per ogni prodotto: senza key, passando da una maglia
// all'altra (miniature "You may also like") React riusava la stessa pagina e
// si portava dietro colore, taglia e lato scelti sul prodotto precedente.
function ProductPageFresh() {
  const { id } = useParams()
  return <ProductPage key={id} />
}

export default function App() {
  const { pathname, search } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  // Pagina dell'altro dominio (link vecchi, navigazione interna): ci si va.
  // Di solito ci pensa gia' vercel.json prima che l'app parta.
  const away = crossSiteUrl(pathname, search, getProductById)
  useEffect(() => { if (away) window.location.replace(away) }, [away])
  // Zack e' la facciata ("/"); il negozio JAYL sta su /jayl. Vedi src/lib/world.js.
  const isZack = !isAdmin && worldFor(pathname, getProductById) === ZACK

  useGA4PageTracking()
  useSiteThemeAttribute(isAdmin || isZack)
  // <html data-world="zack">: il font di Zack (Montserrat, come la scritta del
  // logo) al posto di quelli JAYL, solo nel mondo Zack. Vedi index.css.
  useLayoutEffect(() => {
    if (isZack) document.documentElement.setAttribute('data-world', 'zack')
    else document.documentElement.removeAttribute('data-world')
  }, [isZack])

  return (
    <>
      <ScrollToTop />
      {!isAdmin && (isZack ? <ZackNavbar /> : <Navbar />)}
      {!isAdmin && <CartDrawer />}
      {/* Popup email spento (23/11, scelta di Joshua). Il componente resta. */}

      <Suspense fallback={null}>
      <Routes>
        {/* ── Admin (standalone, no Navbar/Footer) — lazy-loaded ─────── */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/product/:id" element={<AdminProductPage />} />

        {/* ── Public site ──────────────────────────────── */}
        <Route path="*" element={
          <main>
            {away ? null : <Routes>
              <Route path="/"                               element={SITE === 'jayl' ? <HomePage /> : <ZackHomePage />} />
              <Route path="/jayl"                           element={SITE === 'jayl' ? <Navigate to="/" replace /> : <HomePage />} />
              <Route path="/zack"                           element={<Navigate to="/" replace />} />
              <Route path="/art"                            element={<ArtPage />} />
              <Route path="/objects"                        element={<ObjectsPage />} />
              <Route path="/artist"                         element={<ArtistPage />} />
              <Route path="/product/:id"                    element={<ProductPageFresh />} />
              <Route path="/checkout"                       element={<CheckoutPage />} />
              <Route path="/order-confirmation/:orderId"    element={<OrderConfirmationPage />} />
              <Route path="/wishlist"  element={<WishlistPage />} />
              <Route path="/track"              element={<TrackPage />} />
              <Route path="/collection/:slug"  element={<CollectionPage />} />
              <Route path="/ambassador/:id"    element={<AmbassadorPage />} />
              <Route path="/contact"  element={<ContactPage />} />
              <Route path="/shipping" element={<ShippingPage />} />
              <Route path="/returns"  element={<ReturnsPage />} />
              <Route path="/terms"    element={<TermsPage />} />
              <Route path="/privacy"  element={<PrivacyPage />} />
              <Route path="/cookies"  element={<CookiesPage />} />
              {/* Legacy shop URLs → redirect */}
              <Route path="/shop" element={<Navigate to="/art" replace />} />
              <Route path="*"     element={<NotFound />} />
            </Routes>}
          </main>
        } />
      </Routes>
      </Suspense>

      {!isAdmin && (isZack ? <ZackFooter /> : <Footer />)}
      {!isAdmin && <CookieBanner zack={isZack} />}
    </>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen bg-white pt-32 flex flex-col items-center justify-center text-center px-4">
      <p className="section-label-light text-ink-muted mb-4">404</p>
      <h1 className="font-display text-5xl text-ink mb-4">Page not found</h1>
      <p className="text-ink-secondary mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-ink">Go Home</Link>
    </div>
  )
}
