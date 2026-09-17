import { useEffect, useRef, useState } from 'react'
import {
  BUSINESS_UNIT_ID,
  LOCALE,
  TEMPLATES,
  CONSENT_EVENT,
  hasConsent,
  isConfigured,
  loadTrustpilotScript,
} from '@/lib/trustpilot'

/**
 * Widget Trustpilot.
 *
 * Il punto delicato è uno solo, ed è il motivo per cui questo componente esiste
 * invece di un div incollato in pagina: lo script bootstrap di Trustpilot
 * scansiona il DOM UNA VOLTA, al primo caricamento. jayl.store è una SPA con
 * react-router, quindi chi arriva in home e poi apre una pagina prodotto lato
 * client non fa ripartire quella scansione e si ritrova un buco al posto del
 * widget. La cura è chiamare loadFromElement() a mano quando il nodo è montato.
 *
 * Uso:
 *   <TrustBox variant="micro" />                     riga sotto il prezzo
 *   <TrustBox variant="carousel" className="my-12" /> sezione in home
 *
 * Il tema è "dark" di default perché il sito è su off-black; nelle sezioni
 * crema va passato theme="light", altrimenti il widget si porta dietro il
 * proprio fondo e stacca dalla pagina.
 *
 * Finché BUSINESS_UNIT_ID o il template della variante sono vuoti in
 * src/lib/trustpilot.js, il componente non renderizza nulla — si può montare
 * ovunque prima di avere le credenziali senza lasciare spazi vuoti in pagina.
 */
export default function TrustBox({ variant = 'micro', className = '', theme = 'dark' }) {
  const ref = useRef(null)
  const [allowed, setAllowed] = useState(() => hasConsent())

  // Se il consenso arriva mentre la pagina è già aperta, il widget deve
  // comparire senza che l'utente ricarichi — altrimenti l'unico momento in cui
  // qualcuno accetta i cookie è anche l'unico in cui il widget non c'è.
  useEffect(() => {
    if (allowed) return
    const onGrant = () => setAllowed(true)
    window.addEventListener(CONSENT_EVENT, onGrant)
    return () => window.removeEventListener(CONSENT_EVENT, onGrant)
  }, [allowed])

  useEffect(() => {
    if (!allowed || !isConfigured(variant)) return
    let cancelled = false

    loadTrustpilotScript()
      .then((Trustpilot) => {
        // Il nodo può essere sparito mentre lo script scaricava (navigazione
        // veloce): senza questo controllo si chiama loadFromElement su null.
        if (cancelled || !ref.current || !Trustpilot) return
        Trustpilot.loadFromElement(ref.current, true)
      })
      .catch(() => {
        // Script bloccato da un adblocker o rete giù. Non è un errore da
        // mostrare: il widget resta vuoto, la pagina funziona.
      })

    return () => { cancelled = true }
  }, [allowed, variant])

  if (!isConfigured(variant)) return null
  if (!allowed) return null

  const tpl = TEMPLATES[variant]

  return (
    <div className={className}>
      <div
        ref={ref}
        className="trustpilot-widget"
        data-locale={LOCALE}
        data-template-id={tpl.id}
        data-businessunit-id={BUSINESS_UNIT_ID}
        data-style-height={tpl.height}
        data-style-width={tpl.width}
        data-theme={theme}
        {...(tpl.token ? { 'data-token': tpl.token } : {})}
      >
        {/* Fallback se lo script non parte: un link al profilo è comunque
            meglio di un buco, e Trustpilot lo sostituisce quando carica. */}
        <a
          href={`https://www.trustpilot.com/review/jayl.store`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Trustpilot
        </a>
      </div>
    </div>
  )
}
