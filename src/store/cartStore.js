import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),

      addItem: (product, options = {}) => {
        const { size, color, frame } = options
        // Build a unique key from product + variant selection
        const variantKey = `${product.id}__${size || 'default'}__${color || 'default'}__${frame || 'none'}`

        set((state) => {
          const existing = state.items.find((i) => i.variantKey === variantKey)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantKey === variantKey ? { ...i, quantity: i.quantity + 1 } : i
              ),
            }
          }

          // Calculate price including any variant upcharges
          const sizeObj = product.sizes?.find((s) => s.id === size)
          const frameObj = product.frames?.find((f) => f.id === frame)
          const unitPrice = (sizeObj?.price ?? product.price) + (frameObj?.price ?? 0)

          return {
            items: [
              ...state.items,
              {
                variantKey,
                product,
                size,
                color,
                frame,
                quantity: 1,
                unitPrice,
              },
            ],
          }
        })
      },

      removeItem: (variantKey) => {
        set((state) => ({
          items: state.items.filter((i) => i.variantKey !== variantKey),
        }))
      },

      updateQuantity: (variantKey, quantity) => {
        if (quantity < 1) {
          get().removeItem(variantKey)
          return
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.variantKey === variantKey ? { ...i, quantity } : i
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      get itemCount() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },

      get subtotal() {
        return get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
      },
    }),
    {
      name: 'jayl-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
)
