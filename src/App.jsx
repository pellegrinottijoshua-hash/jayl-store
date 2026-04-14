import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
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

// Full-screen immersive pages — no footer, no scroll-to-top
const NO_FOOTER = ['/', '/art', '/objects', '/artist', '/checkout']

export default function App() {
  const { pathname } = useLocation()
  const showFooter = !NO_FOOTER.some((p) => pathname === p || pathname.startsWith(p + '/'))

  return (
    <>
      <Navbar />
      <CartDrawer />

      <main>
        <Routes>
          <Route path="/"                               element={<HomePage />} />
          <Route path="/art"                            element={<ArtPage />} />
          <Route path="/objects"                        element={<ObjectsPage />} />
          <Route path="/artist"                         element={<ArtistPage />} />
          <Route path="/product/:slug"                  element={<ProductPage />} />
          <Route path="/checkout"                       element={<CheckoutPage />} />
          <Route path="/order-confirmation/:orderId"    element={<OrderConfirmationPage />} />
          {/* Legacy shop URLs → redirect */}
          <Route path="/shop" element={<Navigate to="/art" replace />} />
          <Route path="*"     element={<NotFound />} />
        </Routes>
      </main>

      {showFooter && <Footer />}
    </>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen bg-white pt-32 flex flex-col items-center justify-center text-center px-4">
      <p className="section-label-light text-ink-muted mb-4">404</p>
      <h1 className="font-display text-5xl text-ink mb-4">Page not found</h1>
      <p className="text-ink-secondary mb-8">The page you're looking for doesn't exist.</p>
      <a href="/" className="btn-ink">Go Home</a>
    </div>
  )
}
