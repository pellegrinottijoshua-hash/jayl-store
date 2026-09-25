import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * "Never miss a drop", in una riga: email + Subscribe.
 *
 * Il blocco di prima (titolo, paragrafo sul patto del drop, countdown del
 * prossimo) spiegava cosa succede dopo l'iscrizione a chi non si era ancora
 * iscritto. Sotto il drop basta il campo: stesso endpoint di
 * EmailCapturePopup (/api/capture-email), nessun codice server nuovo.
 */
export default function SubscribeForm({ className }) {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/capture-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setSubmitted(true)
      // Stessa chiave che EmailCapturePopup scrive al suo submit: senza, chi
      // si iscrive qui si vede chiedere la stessa email pochi secondi dopo.
      try { localStorage.setItem('jayl-email-popup', 'subscribed') } catch {}
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <p className={cn('text-center text-xs tracking-[0.2em] uppercase text-cream/70 py-3', className)}>
        You're on the list.
      </p>
    )
  }

  return (
    <div className={className}>
      <form onSubmit={onSubmit} className="flex max-w-sm mx-auto w-full border border-border focus-within:border-border-light transition-colors">
        <label htmlFor="subscribe-email" className="sr-only">Email</label>
        <input
          id="subscribe-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          autoComplete="email"
          className="flex-1 min-w-0 bg-transparent text-cream px-4 py-2.5 text-xs focus:outline-none placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 bg-cream text-off-black px-5 py-2.5 text-[10px] font-sans tracking-[0.2em] uppercase disabled:opacity-40 transition-opacity hover:opacity-90"
        >
          {loading ? '…' : 'Subscribe'}
        </button>
      </form>
      {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
    </div>
  )
}
