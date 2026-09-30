# Prossima sessione con Troy (parte tecnica)

Apri Claude Code in `~/jayl-store/` e scrivi:
> **Troy, leggi PROSSIMA-SESSIONE.md e partiamo.**

Il marketing è in `~/Desktop/jayl streetwear/MARKETING-STORE.md`. Qui c'è solo il lavoro sul codice che serve a misurarlo.

⚠️ Nel repo ci sono modifiche di Brandy non ancora committate: `CLAUDE.md` (intestazione di Troy), `STATO.md` e questo file. Includile nel primo commit, dopo `/sync-main`.

## Cosa fare, in ordine
1. **Analitica senza cookie.** Oggi GA4 (`index.html`) conta solo chi accetta il banner, quindi i circa 160 clic delle ads spariscono.
   - Valuta Vercel Web Analytics (verifica i limiti del piano Hobby) o un'alternativa gratuita senza cookie.
   - Servono 3 eventi: scheda vista, aggiunta al carrello, checkout iniziato.
   - Nessun dato personale. I parametri UTM (`utm_campaign`, `utm_content`) devono essere leggibili nei report.
2. **Scheda prodotto dal telefono.**
   - Misura il primo caricamento nel browser in-app di Instagram: il peso delle immagini hero, cosa si vede nei primi 3 secondi (prezzo, "free shipping", il prodotto vero).
   - PageSpeed Insights il 30 settembre aveva la quota esaurita: riprova, oppure usa Lighthouse in locale.
3. **Retargeting.** Controlla se esiste un pixel Meta. Se non c'è, proponilo, rispettando il consenso ai cookie. Non installarlo senza l'ok di Joshua.

## Regole
- Segui le regole git di `CLAUDE.md`: `/sync-main` prima del push e `/verify-live` dopo.
- **Il push va in produzione: prima chiedi l'ok a Joshua.**
- Aggiungi un file in `api/` solo dopo aver controllato `vercel.json` (limite di funzioni del piano Hobby).

## A fine sessione
Aggiorna `STATO.md`: cosa misura adesso il sito e dove si leggono i numeri.
