import { useEffect, useState } from 'react'

/**
 * Contatore live del drop. Il conteggio non può venire dal bundle: sarebbe
 * congelato al deploy. Fallisce in silenzio — senza dati la UI mostra la
 * dimensione dell'edizione, che è sempre vera.
 */
export function useDropStatus() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/drop-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setStatus(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { status, loading }
}
