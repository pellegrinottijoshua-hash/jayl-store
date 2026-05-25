/**
 * /api/gmf — Google Merchant Center product feed
 * Returns an RSS 2.0 / Google Shopping XML feed for all admin-managed products.
 * Submit the feed URL (https://jayl.store/api/gmf) to Google Merchant Center.
 */
import { adminProducts } from '../src/data/admin-products.js'

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default async function handler(req, res) {
  const items = adminProducts.map(p => {
    const price    = ((p.price ?? 0) / 100).toFixed(2)
    const imageUrl = p.image || (p.images?.[0] ?? '')
    const link     = `https://jayl.store/product/${p.id}`
    const title    = escapeXml(p.seoTitle || p.name)
    const desc     = escapeXml((p.description || '').slice(0, 5000))
    const img      = escapeXml(imageUrl)

    // Additional images (up to 10 extra)
    const extraImages = (p.images || [])
      .slice(0, 10)
      .filter(u => u && u !== imageUrl)
      .map(u => `    <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`)
      .join('\n')

    // Sizes as separate item_group_id variants
    const sizes = (p.sizes || []).map(s => s.id || s.label).filter(Boolean)
    const sizeAttr = sizes.length > 0 ? `    <g:size>${escapeXml(sizes.join(', '))}</g:size>` : ''

    return `  <item>
    <g:id>${escapeXml(p.id)}</g:id>
    <g:title>${title}</g:title>
    <g:description>${desc}</g:description>
    <g:link>${link}</g:link>
    <g:image_link>${img}</g:image_link>
${extraImages ? extraImages + '\n' : ''}    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>${price} EUR</g:price>
    <g:brand>JAYL</g:brand>
    <g:mpn>${escapeXml(p.id)}</g:mpn>
    <g:item_group_id>${escapeXml(p.id)}</g:item_group_id>
    <g:product_type>Apparel &amp; Accessories &gt; Clothing &gt; Shirts &amp; Tops</g:product_type>
    <g:google_product_category>212</g:google_product_category>
    <g:gender>unisex</g:gender>
    <g:age_group>adult</g:age_group>
    <g:material>cotton</g:material>
${sizeAttr ? sizeAttr + '\n' : ''}    <g:shipping>
      <g:country>US</g:country>
      <g:service>Free Shipping</g:service>
      <g:price>0 EUR</g:price>
    </g:shipping>
    ${p.collection ? `<g:custom_label_0>${escapeXml(p.collection)}</g:custom_label_0>` : ''}
    ${p.movement   ? `<g:custom_label_1>${escapeXml(p.movement)}</g:custom_label_1>`   : ''}
  </item>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>JAYL — Premium Art &amp; Wearable Art</title>
  <link>https://jayl.store</link>
  <description>Premium print-on-demand art and apparel. AI-reinterpreted art movements, contemporary subjects. Free worldwide shipping.</description>
${items}
</channel>
</rss>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return res.status(200).send(xml)
}
