// Prezzo barrato: vale solo se il vecchio prezzo (compareAtPrice) e' davvero
// piu' alto. Si paga sempre `price`: Stripe non legge mai compareAtPrice.
export const isOnSale = (was, now) => Number.isInteger(was) && was > now
