import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CONSENT_EVENT } from '@/lib/trustpilot'

const STORAGE_KEY = 'jayl_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let choice = null
    try { choice = localStorage.getItem(STORAGE_KEY) } catch {}
    // Restore full consent immediately if the user already accepted.
    // (Marketing pixels self-load from index.html on 'accepted'.)
    if (choice === 'accepted' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage:  'granted',
        ad_storage:         'granted',
        ad_user_data:       'granted',
        ad_personalization: 'granted',
      })
    }
    // Show banner only if user hasn't made a choice yet
    if (!choice) setVisible(true)
  }, [])

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, 'accepted') } catch {}
    // Grant analytics + marketing consent and fire first page_view
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage:  'granted',
        ad_storage:         'granted',
        ad_user_data:       'granted',
        ad_personalization: 'granted',
      })
      window.gtag('event', 'page_view', {
        page_path:     window.location.pathname,
        page_location: window.location.href,
      })
    }
    // Load the marketing pixels (Meta + Pinterest) now that consent is given
    if (typeof window.__jaylLoadMarketing === 'function') window.__jaylLoadMarketing()
    // Tell already-mounted consent-gated widgets (Trustpilot) they can load
    // now, so they appear without a reload.
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT))
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
      {/* Compatto anche su telefono: testo breve a sinistra, i due bottoni sulla
          stessa riga a destra. Prima il testo intero (5 righe a 375px) e i
          bottoni impilati occupavano ~40% dello schermo e coprivano prezzo,
          taglie e "Add to cart" della scheda prodotto — proprio a chi arriva
          da un ad e non ha ancora deciso se accettare. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
        {/* Text */}
        <p className="flex-1 text-[11px] sm:text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Essential cookies always. Analytics and marketing (Google, Meta, Pinterest) only if you
          accept.{' '}
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
            className="text-xs px-3 sm:px-4 py-2 border transition-colors"
            style={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="text-xs px-4 sm:px-5 py-2 font-medium transition-colors"
            style={{ backgroundColor: '#C4A35A', color: '#111111' }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
