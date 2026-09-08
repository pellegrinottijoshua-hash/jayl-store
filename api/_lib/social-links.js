// Definizione UNICA dei canali social del sito, condivisa da chi li scrive
// (l'azione admin save-social-links in api/admin.js), da chi li mostra
// (src/components/layout/Navbar.jsx) e dal form che li raccoglie
// (SettingsTab in src/pages/AdminPage.jsx).
//
// Perché una definizione sola: finora la lista viveva in tre posti scollegati,
// e le tre copie erano già divergenti. `facebook` esisteva in
// src/data/social-links.js, non aveva un campo nel pannello, non aveva
// un'icona in navbar e veniva scartato dalla whitelist del server — cioè un
// canale che il file prometteva e che nessun percorso poteva riempire. È il
// modo di fallire peggiore: silenzioso, e visibile solo leggendo il codice.
// Aggiungere un canale ora significa aggiungere una riga qui (più la sua
// icona in Navbar, che è JSX e non può stare in un file importato da Node).
//
// Importabile sia da Node (funzioni serverless) sia da Vite (client) — vedi
// scripts/check-api-imports.js. Nessun JSX qui dentro, per questo motivo.

export const SOCIAL_LINKS_PATH = 'src/data/social-links.js'

/**
 * I canali, nell'ordine in cui compaiono in navbar e nel pannello.
 *
 * `base` serve a espandere un handle scritto senza protocollo: un admin che
 * digita "jayl" o "@jayl" invece dell'URL completo otterrebbe altrimenti un
 * href relativo — un link che porta a jayl.store/jayl, cioè una 404 servita
 * dal proprio sito invece del profilo. Con `base` diventa l'URL giusto.
 */
export const SOCIAL_CHANNELS = [
  { key: 'instagram', label: 'Instagram', base: 'https://instagram.com/',  handlePrefix: ''  },
  { key: 'tiktok',    label: 'TikTok',    base: 'https://tiktok.com/',     handlePrefix: '@' },
  { key: 'youtube',   label: 'YouTube',   base: 'https://youtube.com/',    handlePrefix: '@' },
  { key: 'pinterest', label: 'Pinterest', base: 'https://pinterest.com/',  handlePrefix: ''  },
  { key: 'x',         label: 'X',         base: 'https://x.com/',          handlePrefix: ''  },
  { key: 'facebook',  label: 'Facebook',  base: 'https://facebook.com/',   handlePrefix: ''  },
]

export const SOCIAL_KEYS = SOCIAL_CHANNELS.map((c) => c.key)

/** Esempio mostrato come placeholder nel campo del pannello. */
export function socialPlaceholder(channel) {
  return `${channel.base}${channel.handlePrefix}jayl`
}

/**
 * Normalizza il valore di un canale in un URL sicuro da mettere in un href,
 * o in stringa vuota (= canale non collegato, nessuna icona mostrata).
 *
 * Due casi che vale la pena gestire qui e non "dopo":
 *
 * 1. Un handle senza protocollo ("jayl", "@jayl") viene espanso con `base`.
 *    Senza, finirebbe in <a href="jayl"> — un link relativo che porta a una
 *    404 del proprio sito, e che in un test veloce "sembra funzionare" perché
 *    il click apre comunque qualcosa.
 *
 * 2. Qualunque schema che non sia http/https viene RIFIUTATO. Questi valori
 *    finiscono direttamente in un href renderizzato a ogni visitatore: un
 *    `javascript:` scritto qui sarebbe XSS su tutte le pagine del sito. Il
 *    pannello è dietro password, ma "solo l'admin può scriverlo" non è una
 *    ragione per non filtrarlo — è un input che diventa codice eseguibile
 *    nel browser di chiunque.
 */
export function normalizeSocialLink(value, channel) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      return (url.protocol === 'http:' || url.protocol === 'https:') ? url.toString() : ''
    } catch {
      return ''
    }
  }

  // Qualunque altro schema esplicito (javascript:, data:, mailto:…) è rifiutato,
  // non "riparato": non esiste un handle legittimo che contenga i due punti.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return ''

  const handle = raw.replace(/^@+/, '')
  if (!handle) return ''
  return `${channel.base}${channel.handlePrefix}${handle}`
}

/**
 * L'oggetto completo dei link, normalizzato e con TUTTE le chiavi presenti —
 * anche quelle vuote, così il file scritto su GitHub documenta da solo quali
 * canali esistono invece di lasciar credere che i mancanti non siano
 * supportati.
 */
export function sanitizeSocialLinks(links = {}) {
  return Object.fromEntries(
    SOCIAL_CHANNELS.map((c) => [c.key, normalizeSocialLink(links[c.key], c)]),
  )
}

/**
 * Serializza src/data/social-links.js nella sua forma canonica. Unico punto
 * che genera il testo del file, come serializeDropConfig per il drop: il file
 * viene riscritto per intero a ogni salvataggio dal pannello, quindi una
 * versione scritta a mano in un formato diverso verrebbe comunque appiattita
 * al primo save — meglio che i due percorsi producano lo stesso identico testo.
 */
export function serializeSocialLinks(links) {
  return `// Canali social del sito — si compilano da Admin → Settings → Social Links.
// Il salvataggio committa questo file su GitHub e fa partire un deploy (~2 min).
// Le chiavi sono definite in api/_lib/social-links.js (SOCIAL_CHANNELS): una
// chiave in più qui dentro non verrebbe né mostrata né salvata.
// Un canale vuoto non mostra nessuna icona.
export const SOCIAL_LINKS = ${JSON.stringify(sanitizeSocialLinks(links), null, 2)}
`
}
