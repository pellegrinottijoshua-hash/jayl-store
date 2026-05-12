/**
 * JaylLogo — JAYL wordmark component
 *
 * Props:
 *   color    — explicit fill color; defaults to 'currentColor' (inherits from parent)
 *   height   — logo height in px (width scales proportionally)
 *   className — extra Tailwind / CSS classes
 *   style    — inline style overrides
 *   asLink   — if true, wraps in a <Link to="/"> (needs react-router context)
 */

import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function JaylLogo({
  color     = 'currentColor',
  height    = 14,
  className = '',
  style     = {},
  asLink    = false,
}) {
  // Letter-spacing 0.22em on 'JAYL' at the current font-size
  // We approximate the rendered width as ~3.8× the height with this tracking.
  const w = Math.round(height * 3.8)

  const logoEl = (
    <svg
      width={w}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="JAYL"
      role="img"
      className={cn('flex-shrink-0', className)}
      style={style}
    >
      <text
        x="0"
        y={Math.round(height * 0.82)}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight="300"
        fontSize={height}
        letterSpacing={`${(height * 0.22).toFixed(1)}`}
        fill={color}
      >
        JAYL
      </text>
    </svg>
  )

  if (asLink) {
    return (
      <Link to="/" aria-label="JAYL — Home" className="inline-flex items-center">
        {logoEl}
      </Link>
    )
  }

  return logoEl
}
