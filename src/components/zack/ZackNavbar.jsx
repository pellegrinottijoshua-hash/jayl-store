import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Menu, X } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { InstagramIcon, TikTokIcon, YouTubeIcon } from '@/components/layout/Navbar'
import JaylMark from '@/components/JaylMark'
import { ZACK_SOCIAL, JAYL_HOME, Z } from '@/lib/world'
import { cn } from '@/lib/utils'


const ICONS = { instagram: InstagramIcon, youtube: YouTubeIcon, tiktok: TikTokIcon }

export function ZackSocials({ size = 15, className }) {
  return (
    <div className={cn('flex items-center', className)}>
      {ZACK_SOCIAL.map(({ key, label, href }) => {
        const Icon = ICONS[key]
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer"
            aria-label={`Zack the Duck on ${label}`}
            className="transition-opacity duration-200 opacity-70 hover:opacity-100"
            style={{ color: Z.cream }}>
            <Icon size={size} />
          </a>
        )
      })}
    </div>
  )
}

/**
 * La porta verso il negozio JAYL. Gli occhi di Zack si chiudono (un battito
 * lungo), si apre /jayl. Niente Pokémon qui: solo il segno JAYL.
 */
export function JaylDoor({ className, children, onEnter }) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const go = (e) => {
    e.preventDefault()
    onEnter?.()
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return navigate(JAYL_HOME)
    setClosing(true)
    setTimeout(() => { navigate(JAYL_HOME); setTimeout(() => setClosing(false), 120) }, 520)
  }
  return (
    <>
      <a href={JAYL_HOME} onClick={go} className={className}>{children}</a>
      {closing && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center zk-door" style={{ background: Z.black }}>
          <img src="/zack/zack-simbolo.svg" alt="" className="w-[56vw] max-w-[420px] zk-door-eyes" />
        </div>,
        document.body
      )}
    </>
  )
}

export default function ZackNavbar() {
  const { items, toggleCart } = useCartStore()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const count = items.reduce((s, i) => s + i.quantity, 0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  const close = () => setOpen(false)

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="w-full h-6 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
          <p className="font-sans font-light text-[9px] uppercase select-none pl-[0.32em]" style={{ letterSpacing: '0.32em', color: Z.gold }}>
            Free worldwide shipping
          </p>
        </div>

        <div className={cn('h-14 grid grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 transition-colors duration-300',
          scrolled && 'backdrop-blur-md')}
          style={{ background: scrolled ? 'rgba(17,17,17,0.88)' : 'transparent' }}>

          {/* Sinistra: hamburger + social */}
          <div className="flex items-center gap-4">
            <button onClick={() => setOpen(true)} aria-label="Open menu" style={{ color: Z.cream }}
              className="transition-opacity hover:opacity-70">
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <ZackSocials size={15} className="gap-3" />
          </div>

          {/* Centro: la scritta */}
          <Link to="/" aria-label="Zack the Duck — Home" className="block">
            <img src="/zack/zack-scritta.svg" alt="Zack the Duck" className="h-9 sm:h-10 w-auto" draggable={false} />
          </Link>

          {/* Destra: carrello */}
          <div className="flex justify-end">
            <button onClick={toggleCart} className="relative transition-opacity hover:opacity-70" style={{ color: Z.cream }}
              aria-label={`Cart — ${count} item${count !== 1 ? 's' : ''}`}>
              <ShoppingBag size={19} strokeWidth={1.5} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-black text-2xs font-bold rounded-full flex items-center justify-center leading-none"
                  style={{ backgroundColor: Z.gold }}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Menu a tutto schermo */}
      <div className={cn('fixed inset-0 z-[60] flex flex-col transition-opacity duration-300',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}
        style={{ background: Z.black }} aria-hidden={!open}>
        <div className="flex items-center justify-between px-5 h-20">
          <img src="/zack/zack-simbolo.svg" alt="" className="h-8 w-auto" />
          <button onClick={close} aria-label="Close menu" style={{ color: Z.cream }}><X size={22} strokeWidth={1.5} /></button>
        </div>

        <nav className="flex-1 flex flex-col justify-center px-8 gap-5">
          {[
            { label: 'Shop', to: '/#shop' },
            { label: 'Tee', to: '/product/zack-the-duck-tee' },
            { label: 'Hoodie', to: '/product/zack-the-duck-hoodie' },
            { label: 'Crewneck', to: '/product/zack-the-duck-crewneck' },
          ].map(({ label, to }) => (
            <Link key={label} to={to} onClick={close}
              className="font-sans font-bold uppercase leading-none transition-colors"
              style={{ color: Z.cream, fontSize: 'clamp(2.2rem, 9vw, 3.6rem)', letterSpacing: '-0.01em' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = Z.gold }}
              onMouseLeave={(e) => { e.currentTarget.style.color = Z.cream }}>
              {label}
            </Link>
          ))}
          <div className="flex gap-5 mt-4 font-sans text-xs uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(245,240,232,0.55)' }}>
            <Link to="/track" onClick={close}>Track order</Link>
            <Link to="/shipping" onClick={close}>Shipping</Link>
            <Link to="/contact" onClick={close}>Contact</Link>
          </div>
        </nav>

        <div className="px-8 pb-10 flex items-end justify-between">
          <ZackSocials size={20} className="gap-6" />
          {/* La porta: piccola, in fondo. */}
          <JaylDoor onEnter={close}
            className="flex items-center gap-2 font-sans text-[10px] uppercase transition-opacity opacity-60 hover:opacity-100"
          >
            <span style={{ color: Z.gold, letterSpacing: '0.2em' }}>JAYL Art Collection</span>
            <JaylMark size={16} style={{ color: Z.gold }} />
          </JaylDoor>
        </div>
      </div>
    </>
  )
}
