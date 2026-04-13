import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// mode  — persisted: user's preferred section ('art' | 'objects')
// pageTheme — transient: set by each page on mount ('light' | 'dark')
export const useThemeStore = create(
  persist(
    (set) => ({
      mode: 'art',
      pageTheme: 'light',
      setMode: (mode) => set({ mode }),
      setPageTheme: (pageTheme) => set({ pageTheme }),
    }),
    {
      name: 'jayl-mode',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
)
