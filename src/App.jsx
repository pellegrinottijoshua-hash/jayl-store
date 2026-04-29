import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useLayoutEffect } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CartDrawer from '@/components/cart/CartDrawer'
import HomePage from '@/pages/HomePage'
import ArtPage from '@/pages/ArtPage'
import ObjectsPage from '@/pages/ObjectsPage'
import ArtistPage from '@/pages/ArtistPage'
import ProductPage from '@/pages/ProductPage'
import CheckoutPage from '@/pages/CheckoutPage'
import OrderConfirmationPage from '@/pages/OrderConfirmationPage'
import ContactPage from '@/pages/ContactPage'
import ShippingPage from '@/pages/ShippingPage'
import ReturnsPage from '@/pages/ReturnsPage'
import TermsPage from '@/pages/TermsPage'
import PrivacyPage from '@/pages/PrivacyPage'
import CookiesPage from '@/pages/CookiesPage'

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

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <CartDrawer />

      <main>
        <Routes>
          <Route path="/"                               element={<HomePage />} />
          <Route path="/art"                            element={<ArtPage />} />
          <Route path="/objects"                        element={<ObjectsPage />} />
          <Route path="/artist"                         element={<ArtistPage />} />
          <Route path="/product/:id"                    element={<ProductPage />} />
          <Route path="/checkout"                       element={<CheckoutPage />} />
          <Route path="/order-confirmation/:orderId"    element={<OrderConfirmationPage />} />
          <Route path="/contact"  element={<ContactPage />} />
          <Route path="/shipping" element={<ShippingPage />} />
          <Route path="/returns"  element={<ReturnsPage />} />
          <Route path="/terms"    element={<TermsPage />} />
          <Route path="/privacy"  element={<PrivacyPage />} />
          <Route path="/cookies"  element={<CookiesPage />} />
          {/* Legacy shop URLs → redirect */}
          <Route path="/shop" element={<Navigate to="/art" replace />} />
          <Route path="*"     element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
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
