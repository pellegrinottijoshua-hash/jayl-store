import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'jayl_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let choice = null
    try { choice = localStorage.getItem(STORAGE_KEY) } catch {}
    // Restore GA4 consent immediately if user already accepted
    if (choice === 'accepted' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' })
    }
    // Show banner only if user hasn't made a choice yet
    if (!choice) setVisible(true)
  }, [])

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, 'accepted') } catch {}
    // Grant GA4 analytics consent and fire first page_view
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' })
      window.gtag('event', 'page_view', {
        page_path:     window.location.pathname,
        page_location: window.location.href,
      })
    }
    setVisible(false)
  }

  const decline = () => {
    try { localStorage.setItem(STORAGE_KEY, 'declined') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[200] border-t"
      style={{ backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Text */}
        <p className="flex-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Utilizziamo cookie essenziali (carrello, sessione) e, con il tuo consenso, cookie analitici
          anonimi (Google Analytics) per migliorare il sito. Nessun cookie pubblicitario.{' '}
          <Link
            to="/cookies"
            onClick={decline}
            className="underline transition-colors"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Cookie policy
          </Link>
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={decline}
            className="text-xs px-4 py-2 border transition-colors"
            style={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            Rifiuta
          </button>
          <button
            onClick={accept}
            className="text-xs px-5 py-2 font-medium transition-colors"
            style={{ backgroundColor: '#C4A35A', color: '#111111' }}
          >
            Accetta
          </button>
        </div>
      </div>
    </div>
  )
}
