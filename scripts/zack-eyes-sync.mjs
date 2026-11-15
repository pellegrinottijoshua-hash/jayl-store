// Copia gli occhi di Zack dalla home-occhi (motion-lab) dentro lo store.
//
//   node scripts/zack-eyes-sync.mjs ["/percorso/home-occhi/index.html"]
//
// Prende dall'HTML il disegno SVG fisso (occhi, becco, clip) e i dati delle
// espressioni (D), e li scrive in src/components/zack/zackEyesData.js. Il
// motore (ZackEyes.jsx) resta nello store. Da rilanciare dopo ogni
// `python3 esporta_home.py` nella cartella di Zack.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const src = process.argv[2] ||
  path.join(os.homedir(), 'Desktop/zack the duck/motion-lab/home-occhi/index.html')
const html = readFileSync(src, 'utf8')

const svg = /<svg id="zack" viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/.exec(html)
if (!svg) throw new Error('SVG #zack non trovato in ' + src)
const data = /const D = \/\*DATI\*\/(\{.*\})\/\*\/DATI\*\/;/.exec(html)
if (!data) throw new Error('Dati D non trovati in ' + src)
const idle = /const IDLE_CYCLE = (\[[\s\S]*?\]);/.exec(html)

// Gli id dell'SVG diventano unici nello store (zk-…), cosi' non si scontrano
// con altri SVG della pagina.
const markup = svg[2]
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/id="(\w+)"/g, 'id="zk-$1"')
  .replace(/url\(#(\w+)\)/g, 'url(#zk-$1)')
  .trim()

const out = `// GENERATO da scripts/zack-eyes-sync.mjs — non modificare a mano.
// Fonte: motion-lab/home-occhi/index.html (Zack the Duck).
export const VIEWBOX = ${JSON.stringify(svg[1])}
export const MARKUP = ${JSON.stringify(markup)}
export const D = ${data[1]}
export const IDLE_CYCLE = ${idle ? idle[1].replace(/\s+/g, ' ') : "['originale']"}
`
const dest = path.resolve('src/components/zack/zackEyesData.js')
writeFileSync(dest, out)
console.log('ok →', dest, `(${(out.length / 1024).toFixed(1)} KB)`)
