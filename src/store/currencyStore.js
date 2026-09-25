import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// La valuta con cui si paga. Il numero e' lo stesso (22 euro o 22 dollari):
// il sito alterna €/$, al checkout si sceglie e si paga esattamente quello.
// Default: dollari per chi e' nelle Americhe (fuso orario), euro per gli altri.
const guess = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone?.startsWith('America/') ? 'usd' : 'eur' } catch { return 'eur' }
}

export const useCurrencyStore = create(
  persist(
    (set) => ({ currency: guess(), setCurrency: (currency) => set({ currency }) }),
    { name: 'jayl-currency' }
  )
)

export const SYMBOL = { eur: '€', usd: '$' }
