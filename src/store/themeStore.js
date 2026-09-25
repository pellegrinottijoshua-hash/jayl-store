import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// mode         — persisted: last-visited section ('art' | 'objects')
// siteTheme    — persisted: the visitor's pick for the shop's dark pages
//                ('dark' | 'cream'). App.jsx mirrors it onto
//                <html data-site-theme>, which flips the palette tokens in
//                index.css; the inline script in index.html applies it before
//                first paint, reading this same persisted key.
// pageTheme    — transient: set by each page ('light' | 'dark')
// activeSection — transient: which nav item is bold ('art' | 'objects' | 'artist' | null)
export const useThemeStore = create(
  persist(
    (set) => ({
      mode: 'art',
      siteTheme: 'dark',
      pageTheme: 'light',
      activeSection: null,
      setMode: (mode) => set({ mode }),
      toggleSiteTheme: () => set((s) => ({ siteTheme: s.siteTheme === 'cream' ? 'dark' : 'cream' })),
      setPageTheme: (pageTheme) => set({ pageTheme }),
      setActiveSection: (activeSection) => set({ activeSection }),
    }),
    {
      name: 'jayl-mode',
      partialize: (state) => ({ mode: state.mode, siteTheme: state.siteTheme }),
    }
  )
)

/**
 * The theme the navbar and page chrome should actually paint for: a 'dark'
 * page becomes a light one under the cream site theme (its tokens are
 * inverted), a 'light' page is light either way.
 */
export function useEffectiveTheme() {
  return useThemeStore((s) => (s.siteTheme === 'cream' ? 'light' : s.pageTheme))
}
