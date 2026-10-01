// Bordi delle schede video della home che sfumano nel fondo della pagina, ai
// lati e in alto e in basso: lo sfondo dei video Kling non e' il nostro nero, e
// senza questa sfumatura ogni video si vede come un riquadro (drop 6, 1/10).
// Usata dal cilindro del telefono (DropHero) e dalle schede desktop (DropDesktop).
export const VIDEO_VIGNETTE = [
  'linear-gradient(90deg, rgb(var(--c-off-black)) 0%, rgb(var(--c-off-black) / 0) 14%, rgb(var(--c-off-black) / 0) 86%, rgb(var(--c-off-black)) 100%)',
  'linear-gradient(180deg, rgb(var(--c-off-black)) 0%, rgb(var(--c-off-black) / 0) 16%, rgb(var(--c-off-black) / 0) 78%, rgb(var(--c-off-black)) 100%)',
].join(', ')
