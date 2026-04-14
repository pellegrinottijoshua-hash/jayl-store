import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// mode         — persisted: last-visited section ('art' | 'objects')
// pageTheme    — transient: set by each page ('light' | 'dark')
// activeSection — transient: which nav item is bold ('art' | 'objects' | 'artist' | null)
export const useThemeStore = create(
  persist(
    (set) => ({
      mode: 'art',
      pageTheme: 'light',
      activeSection: null,
      setMode: (mode) => set({ mode }),
      setPageTheme: (pageTheme) => set({ pageTheme }),
      setActiveSection: (activeSection) => set({ activeSection }),
    }),
    {
      name: 'jayl-mode',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
)
