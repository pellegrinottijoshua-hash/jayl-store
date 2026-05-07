export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { url, filename = 'download' } = req.query
  if (!url) return res.status(400).json({ error: 'url required' })

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Only http/https URLs allowed' })
  }
  if (/localhost|127\.0\.0\.1|::1/.test(url)) {
    return res.status(400).json({ error: 'Internal URLs not allowed' })
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'JAYL-Store/1.0' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) return res.status(502).end()

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const buffer      = Buffer.from(await response.arrayBuffer())

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(buffer)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
}
