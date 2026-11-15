// Il simbolo di Zack (occhi e becco) come icona a currentColor: prende il colore
// del testo accanto, quindi segue i temi di JAYL (nero, panna) e l'hover oro.
// `height` in em: si allinea alla riga in cui sta.
export default function ZackMark({ height = '0.9em', className = '', style }) {
  const mask = 'url(/zack/zack-simbolo.svg) center / contain no-repeat'
  return (
    <span
      aria-hidden
      className={`inline-block align-middle ${className}`}
      style={{
        height,
        aspectRatio: '876 / 386',
        backgroundColor: 'currentColor',
        WebkitMask: mask,
        mask,
        ...style,
      }}
    />
  )
}
