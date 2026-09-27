/**
 * Mockup lisci Gildan 64000, fronte e retro, per ogni colore: stessi render e
 * stessa inquadratura di Gelato (public/mockups/gildan-64000/{colore}-front|back.jpg,
 * da ~/Desktop/jayl streetwear/plain front|back gildan). Servono al trittico
 * della scheda prodotto: il lato non stampato, il colletto e la base su cui
 * appoggiare il disegno del fronte.
 */
export const MOCKUP_COLORS = new Set(['azalea','black','cardinal-red','carolina-blue','charcoal','daisy','dark-chocolate','dark-heather','gold','graphite-heather','heather-maroon','heather-navy','heather-purple','heather-red','heather-royal','ice-grey','irish-green','light-blue','maroon','military-green','natural','navy','purple','red','royal','rs-sport-grey','sand','white'])

export const plainMockup = (colorId, side) =>
  MOCKUP_COLORS.has(colorId) ? `/mockups/gildan-64000/${colorId}-${side}.jpg` : null
