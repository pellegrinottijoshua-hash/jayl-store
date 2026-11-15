import { Link } from 'react-router-dom'
import JaylMark from '@/components/JaylMark'
import { ZackSocials, JaylDoor } from '@/components/zack/ZackNavbar'
import { Z } from '@/lib/world'

// Footer del mondo Zack. In fondo, piccola e quasi nascosta, la porta verso il
// negozio JAYL (il segno JAYL in oro): un easter egg, non una voce di menu.
export default function ZackFooter() {
  const year = new Date().getFullYear()
  const link = 'transition-opacity opacity-60 hover:opacity-100'
  return (
    <footer style={{ background: Z.black, color: Z.cream }} className="px-6 sm:px-10 pt-20 pb-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center gap-6">
          <img src="/zack/zack-simbolo.svg" alt="" className="w-24 opacity-90" draggable={false} />
          <p className="font-sans text-sm" style={{ color: 'rgba(245,240,232,0.6)' }}>
            Deadpan duck. Watch him on
          </p>
          <ZackSocials size={20} className="gap-7" />
        </div>

        <nav className="mt-16 flex flex-wrap justify-center gap-x-7 gap-y-3 font-sans text-[11px] uppercase"
          style={{ letterSpacing: '0.18em' }}>
          <Link to="/track" className={link}>Track order</Link>
          <Link to="/shipping" className={link}>Shipping</Link>
          <Link to="/returns" className={link}>Returns</Link>
          <Link to="/contact" className={link}>Contact</Link>
          <Link to="/terms" className={link}>Terms</Link>
          <Link to="/privacy" className={link}>Privacy</Link>
        </nav>

        <div className="mt-14 flex items-center justify-between font-sans text-[10px]" style={{ color: 'rgba(245,240,232,0.35)' }}>
          <span>© {year} Zack the Duck · a JAYL character · Designed in Venice</span>
          <JaylDoor className="opacity-40 hover:opacity-100 transition-opacity" >
            <span className="sr-only">JAYL Art Collection</span>
            <JaylMark size={18} style={{ color: Z.gold }} title="JAYL Art Collection" />
          </JaylDoor>
        </div>
      </div>
    </footer>
  )
}
