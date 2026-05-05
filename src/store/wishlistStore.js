import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useWishlistStore = create(
  persist(
    (set, get) => ({
      ids: [],

      toggle: (productId) => {
        const { ids } = get()
        set({ ids: ids.includes(productId)
          ? ids.filter(id => id !== productId)
          : [...ids, productId]
        })
      },

      isWishlisted: (productId) => get().ids.includes(productId),
    }),
    { name: 'jayl-wishlist' }
  )
)
