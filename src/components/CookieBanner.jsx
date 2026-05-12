import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'jayl_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show banner only if user hasn't made a choice yet
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, 'accepted') } catch {}
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
          jayl.store usa solo cookie essenziali necessari al funzionamento del sito (carrello, sessione).
          Nessun cookie di tracciamento o pubblicità.{' '}
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
