import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CartDrawer from '@/components/cart/CartDrawer'
import HomePage from '@/pages/HomePage'
import ShopPage from '@/pages/ShopPage'
import ProductPage from '@/pages/ProductPage'
import CheckoutPage from '@/pages/CheckoutPage'
import OrderConfirmationPage from '@/pages/OrderConfirmationPage'

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

// Pages that don't want the standard footer
const NO_FOOTER = ['/checkout']

export default function App() {
  const { pathname } = useLocation()
  const showFooter = !NO_FOOTER.some((p) => pathname.startsWith(p))

  return (
    <>
      <ScrollToTop />
      <Navbar />
      <CartDrawer />

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {showFooter && <Footer />}
    </>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen pt-32 flex flex-col items-center justify-center text-center px-4">
      <p className="section-label text-text-muted mb-4">404</p>
      <h1 className="font-display text-5xl text-cream mb-4">Page not found</h1>
      <p className="text-text-secondary mb-8">The page you're looking for doesn't exist.</p>
      <a href="/" className="btn-primary">Go Home</a>
    </div>
  )
}
