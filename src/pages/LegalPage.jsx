import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'

export default function LegalPage({ title, children }) {
  const { setPageTheme, setActiveSection } = useThemeStore()

  useEffect(() => {
    setPageTheme('light')
    setActiveSection(null)
    document.body.style.overflow = ''
    document.documentElement.style.setProperty('color-scheme', 'light')
    document.body.style.backgroundColor = '#f5f0e8'
    document.body.style.color = '#111111'
    return () => {
      document.documentElement.style.removeProperty('color-scheme')
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [setPageTheme, setActiveSection])

  return (
    <div
      className="min-h-screen w-screen bg-paper pt-[84px]"
      style={{ colorScheme: 'light', backgroundColor: '#f5f0e8', color: '#111111' }}
    >
      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16">
        <h1 className="font-display text-4xl sm:text-5xl text-ink mb-8 leading-tight">{title}</h1>
        <div className="w-full h-px bg-paper-border mb-10" />
        <div className="space-y-6 text-ink-secondary leading-relaxed text-base">
          {children}
        </div>
      </div>
    </div>
  )
}
