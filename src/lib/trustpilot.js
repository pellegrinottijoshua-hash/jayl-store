// Trustpilot — configurazione e caricamento dello script.
//
// Tutti i valori specifici dell'account stanno QUI e solo qui: riempire questi
// tre campi accende l'integrazione su tutto il sito, lasciarli vuoti la tiene
// inerte senza rompere niente (i widget non renderizzano e basta).
//
// Dove si trovano, su business.trustpilot.com:
//   BUSINESS_UNIT_ID → Integrations → TrustBox, è nel codice di ogni widget
//                      come data-businessunit-id (24 caratteri esadecimali)
//   TEMPLATE_ID      → idem, data-template-id, UNO PER TIPO DI WIDGET
//   LOCALE           → la lingua del widget, non del sito
//
// Nota sul consenso: i widget Trustpilot scrivono cookie di terze parti, e il
// nostro banner promette "essential + analytics con consenso". Caricarli a
// prescindere contraddirebbe il testo del banner, quindi sono dietro consenso
// come i pixel Meta/Pinterest. Se un domani si decide che il widget è
// interesse legittimo, si mette REQUIRE_CONSENT a false ed è fatta.

export const BUSINESS_UNIT_ID = ''
export const LOCALE = 'en-US'
export const REQUIRE_CONSENT = true

// Un template per forma di widget. Prendi gli id dal picker TrustBox: quelli
// disponibili dipendono dal piano, quindi se uno di questi non è nel tuo
// account lascialo vuoto e quel widget semplicemente non comparirà.
export const TEMPLATES = {
  // Riga compatta: stelle + numero recensioni. Va sotto il prezzo.
  micro:    { id: '', height: '24px',  width: '100%' },
  // Stelle + punteggio, un po' più grande. Header o footer.
  mini:     { id: '', height: '150px', width: '100%' },
  // Caroselo di recensioni. Home, sezione dedicata.
  carousel: { id: '', height: '240px', width: '100%' },
}

const SCRIPT_SRC =
  'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js'

export const CONSENT_KEY = 'jayl_cookie_consent'
export const CONSENT_EVENT = 'jayl:consent-granted'

export function hasConsent() {
  if (!REQUIRE_CONSENT) return true
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted'
  } catch {
    // Safari in modalità privata può lanciare sull'accesso a localStorage.
    // In dubbio non carichiamo: è il lato prudente.
    return false
  }
}

export function isConfigured(variant) {
  return Boolean(BUSINESS_UNIT_ID && TEMPLATES[variant]?.id)
}

let scriptPromise = null

// Carica il bootstrap una volta sola per sessione. Restituisce sempre la stessa
// promise, così N widget in pagina non scaricano N volte lo script.
export function loadTrustpilotScript() {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    if (window.Trustpilot) return resolve(window.Trustpilot)

    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Trustpilot))
      existing.addEventListener('error', reject)
      return
    }

    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.addEventListener('load', () => resolve(window.Trustpilot))
    s.addEventListener('error', () => {
      // Un adblocker che blocca lo script non deve rompere la pagina: il
      // widget resta vuoto e il resto del sito non se ne accorge.
      scriptPromise = null
      reject(new Error('Trustpilot script blocked or unavailable'))
    })
    document.head.appendChild(s)
  })

  return scriptPromise
}
