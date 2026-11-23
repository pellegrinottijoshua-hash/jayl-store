import Money from '@/components/Money'
import { isOnSale } from '@/lib/sale'

// Il vecchio prezzo barrato, accanto a quello vero.

export default function WasPrice({ was, now, className = '' }) {
  if (!isOnSale(was, now)) return null
  return (
    <span className={`line-through decoration-1 opacity-45 font-normal ${className}`}>
      <span className="sr-only">Was </span>
      <Money cents={was} />
    </span>
  )
}
