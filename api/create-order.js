const GELATO_API_URL = 'https://order.gelatoapis.com/v4/orders'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { items, shippingAddress, email, paymentIntentId } = req.body

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' })
    }
    if (!shippingAddress) {
      return res.status(400).json({ error: 'Shipping address is required' })
    }

    const orderPayload = {
      orderReferenceId: `jayl-${paymentIntentId}`,
      customerReferenceId: email || 'unknown',
      currency: 'USD',
      items: items.map((item) => ({
        itemReferenceId: item.variantKey,
        // gelatoProductId must be set on each product before going live
        productUid: item.product.gelatoProductId || 'photobook_softcover_portrait_a4',
        quantity: item.quantity,
        files: [
          {
            type: 'default',
            url: item.product.image,
          },
        ],
      })),
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        addressLine1: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state || '',
        postCode: shippingAddress.zip,
        country: shippingAddress.country || 'US',
        email: email || '',
        phone: shippingAddress.phone || '',
      },
    }

    const gelatoRes = await fetch(GELATO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.VITE_GELATO_API_KEY,
      },
      body: JSON.stringify(orderPayload),
    })

    const gelatoBody = await gelatoRes.json().catch(() => ({}))

    if (!gelatoRes.ok) {
      console.error('[create-order] Gelato API error:', gelatoRes.status, gelatoBody)
      return res.status(502).json({
        error: 'Failed to create Gelato order',
        details: gelatoBody,
      })
    }

    return res.status(200).json({
      orderId: gelatoBody.id,
      orderReferenceId: gelatoBody.orderReferenceId,
      status: gelatoBody.orderStatus,
      trackingInfo: gelatoBody.shipment || null,
    })
  } catch (err) {
    console.error('[create-order]', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
