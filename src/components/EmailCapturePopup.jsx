import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getDrop } from '../../api/_lib/drop.js'

const STORAGE_KEY = 'jayl-email-popup'
const VISIT_KEY   = 'jayl-visit-count'
const CONSENT_KEY = 'jayl_cookie_consent'

// The popup used to promise JAYL10 (10% off), but applyDiscount() (api/_lib/
// catalog.js) refuses every code once the cart holds a drop item — so it now
// offers what it can actually deliver: access to the drop list. JAYL10 stays
// defined in catalog.js for non-drop orders; this component just stops
// advertising it. Shares STORAGE_KEY with the homepage waitlist section
// (src/pages/HomePage.jsx) so subscribing there also keeps this from
// reappearing — one signup, not two.
function nextDropTitle(cfg) {
  const next = cfg?.next
  if (!next?.number) return 'Prossimo drop'
  const number = `Drop ${String(next.number).padStart(2, '0')}`
  if (!next.startsAt) return number
  const date = new Date(next.startsAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
  return `${number} · ${date}`
}

// Non-blocking bottom-corner card. Triggers on scroll depth OR exit-intent OR a
// short delay for returning visitors — never a fullscreen overlay, so it can't
// intercept clicks on products. Held back until the cookie banner is dismissed
// so the two never stack.
export default function EmailCapturePopup() {
  const [visible,   setVisible]   = useState(false)
  const [enter,     setEnter]     = useState(false)
  const [email,     setEmail]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const title = nextDropTitle(getDrop())

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return // already dismissed/subscribed

    let visits = 0
    try { visits = (parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) || 0) + 1 } catch {}
    try { localStorage.setItem(VISIT_KEY, String(visits)) } catch {}

    let done = false
    const show = () => {
      if (done) return
      // Don't stack on top of the cookie banner — wait until a choice was made.
      try { if (!localStorage.getItem(CONSENT_KEY)) return } catch {}
      done = true
      setVisible(true)
      cleanup()
    }

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max > 0 && window.scrollY / max > 0.5) show()
    }
    const onExit = (e) => { if (e.clientY <= 0) show() }        // exit-intent
    const timer  = visits >= 2 ? setTimeout(show, 6_000) : null // returning-visitor nudge

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('mouseout', onExit)
    function cleanup() {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mouseout', onExit)
      if (timer) clearTimeout(timer)
    }
    return cleanup
  }, [])

  useEffect(() => { if (visible) requestAnimationFrame(() => setEnter(true)) }, [visible])

  const dismiss = () => {
    setEnter(false)
    localStorage.setItem(STORAGE_KEY, 'dismissed')
    setTimeout(() => setVisible(false), 250)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/capture-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setSubmitted(true)
      localStorage.setItem(STORAGE_KEY, 'subscribed')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div
      className={`fixed z-[60] bottom-4 right-4 left-4 sm:left-auto sm:w-[370px] transition-all duration-300 ${enter ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
      role="dialog"
      aria-label="Lista d'attesa drop"
    >
      <div className="relative bg-off-black border border-border rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-text-muted hover:text-cream transition-colors z-10"
          aria-label="Chiudi"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          {submitted ? (
            <div className="text-center space-y-3">
              <h2 className="font-display text-xl text-cream">Sei in lista.</h2>
              <p className="text-text-muted text-xs">
                Ti avvisiamo appena il drop apre.
              </p>
              <button
                onClick={dismiss}
                className="text-xs text-text-muted hover:text-cream underline underline-offset-2 transition-colors"
              >
                Continua a guardare →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">Prossimo drop</p>
                <h2 className="font-display text-xl text-cream leading-tight">{title}</h2>
              </div>
              <p className="text-text-secondary text-xs leading-relaxed">
                entra nella lista: i pezzi sono 20 per design
              </p>
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-gray-900 border border-border text-cream px-4 py-2.5 text-sm focus:outline-none focus:border-border-light transition-colors placeholder:text-text-muted"
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-cream text-off-black py-2.5 text-sm font-semibold tracking-wide disabled:opacity-40 transition-opacity hover:opacity-90"
                >
                  {loading ? 'Just a sec…' : 'AVVISAMI'}
                </button>
              </form>
              <p className="text-text-muted text-[10px] text-center">No spam. Unsubscribe any time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
