/**
 * api/_lib/email.js — Resend transactional email helper + HTML templates
 *
 * Prerequisites:
 *   1. Sign up at https://resend.com
 *   2. Add & verify the domain jayl.store (DNS TXT/MX records)
 *   3. Set RESEND_API_KEY in Vercel environment variables
 *
 * Sending address: orders@jayl.store
 * If RESEND_API_KEY is missing, all calls are no-ops (logged, never throw).
 */

const FROM_ADDRESS = 'JAYL <orders@jayl.store>'
const STORE_EMAIL  = 'thejaylstore@gmail.com'
const SITE_URL     = 'https://jayl.store'

// ── Shared HTML wrapper ───────────────────────────────────────────────────────

function htmlWrapper(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>JAYL</title>
</head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:Georgia,'Times New Roman',serif;color:#e8e0d0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;padding:40px 20px">
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">

        <!-- Logo -->
        <tr>
          <td style="padding-bottom:28px;border-bottom:1px solid rgba(184,151,74,0.22)">
            <a href="${SITE_URL}" style="text-decoration:none">
              <span style="font-family:Georgia,serif;letter-spacing:0.35em;text-transform:uppercase;font-size:13px;color:#b8974a;font-weight:400">JAYL</span>
            </a>
          </td>
        </tr>

        <!-- Dynamic body -->
        ${body}

        <!-- Footer -->
        <tr>
          <td style="padding-top:28px;border-top:1px solid #1a1a1a">
            <p style="margin:0;font-size:11px;color:#4a4a4a;line-height:1.9">
              Questions? <a href="mailto:${STORE_EMAIL}" style="color:#b8974a;text-decoration:none">${STORE_EMAIL}</a><br>
              JAYL · Venice, Italy &nbsp;·&nbsp; <a href="${SITE_URL}" style="color:#b8974a;text-decoration:none">jayl.store</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Template: order confirmation ──────────────────────────────────────────────

export function buildOrderConfirmationEmail({ orderId, items = [], total = 0, shipping = 0, shippingAddress = {} }) {
  const fmt = cents => `€${(Math.max(0, cents) / 100).toFixed(2)}`

  // Items rows
  const itemsHtml = items.length > 0 ? `
    <tr><td style="padding:24px 0 16px">
      <p style="margin:0 0 14px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8974a">Your items</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${items.map(item => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1a1a">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="48" style="padding-right:14px;vertical-align:top">
                  ${item.image
                    ? `<img src="${item.image}" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:cover;border:1px solid #242424" alt="">`
                    : `<div style="width:48px;height:48px;background:#1a1a1a;border:1px solid #242424"></div>`}
                </td>
                <td style="vertical-align:top">
                  <p style="margin:0 0 3px;font-size:14px;color:#e8e0d0;line-height:1.4">${item.name || 'Item'}</p>
                  <p style="margin:0;font-size:12px;color:#7a7268">
                    ${[item.color, item.size].filter(Boolean).join(' · ')}${item.quantity > 1 ? ` &times; ${item.quantity}` : ''}
                  </p>
                </td>
                <td align="right" style="vertical-align:top;font-size:14px;color:#e8e0d0;white-space:nowrap;padding-left:12px">
                  ${fmt(item.unitPrice * item.quantity)}
                </td>
              </tr>
            </table>
          </td>
        </tr>`).join('')}
      </table>
    </td></tr>` : ''

  // Shipping address block
  const addrParts = [
    [shippingAddress.firstName, shippingAddress.lastName].filter(Boolean).join(' '),
    shippingAddress.address,
    [shippingAddress.city, shippingAddress.state, shippingAddress.zip].filter(Boolean).join(', '),
    shippingAddress.country,
  ].filter(Boolean)
  const addrHtml = addrParts.join('<br>')

  const body = `
    <tr><td style="padding:28px 0 8px">
      <h1 style="margin:0;font-weight:400;font-size:28px;color:#e8e0d0;letter-spacing:-0.01em">Order confirmed.</h1>
    </td></tr>
    <tr><td style="padding:0 0 24px">
      <p style="margin:0;font-size:15px;color:#9a9587;line-height:1.75">
        Thank you — your order is now with our print partner.<br>
        Production usually takes 2–4 business days. We'll email you when it ships.
      </p>
    </td></tr>

    <!-- Order ID box -->
    <tr><td style="padding:16px;background:#111111;border:1px solid #222222;margin-bottom:20px">
      <p style="margin:0 0 5px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8974a">Order reference</p>
      <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:13px;color:#e8e0d0;letter-spacing:0.05em">${orderId}</p>
    </td></tr>

    ${itemsHtml}

    <!-- Totals -->
    <tr><td style="padding:16px 0;border-top:1px solid #1e1e1e;border-bottom:1px solid #1e1e1e">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:13px;color:#9a9587;padding:4px 0">Shipping</td>
          <td align="right" style="font-size:13px;color:#e8e0d0;padding:4px 0">${shipping === 0 ? 'Free' : fmt(shipping)}</td>
        </tr>
        <tr>
          <td style="font-size:15px;font-weight:bold;color:#e8e0d0;padding:10px 0 0">Total</td>
          <td align="right" style="font-size:15px;font-weight:bold;color:#e8e0d0;padding:10px 0 0">${fmt(total)}</td>
        </tr>
      </table>
    </td></tr>

    <!-- Ship to -->
    ${addrHtml ? `
    <tr><td style="padding:20px 0">
      <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8974a">Shipping to</p>
      <p style="margin:0;font-size:13px;color:#9a9587;line-height:1.8">${addrHtml}</p>
    </td></tr>` : ''}

    <!-- CTA -->
    <tr><td style="padding:8px 0 28px">
      <a href="${SITE_URL}/track?id=${encodeURIComponent(orderId)}"
         style="display:inline-block;background:#b8974a;color:#0c0c0c;font-size:11px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;padding:13px 28px">
        Track your order
      </a>
    </td></tr>`

  return {
    subject: `Order confirmed — ${orderId}`,
    html:    htmlWrapper(body),
  }
}

// ── Template: contact form notification (to store owner) ──────────────────────

export function buildContactNotificationEmail({ name, email, subject: subj, message }) {
  const body = `
    <tr><td style="padding:28px 0 8px">
      <h1 style="margin:0;font-weight:400;font-size:24px;color:#e8e0d0">New contact message</h1>
    </td></tr>
    <tr><td style="padding:0 0 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222">
        <tr><td style="padding:20px">
          <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8974a">From</p>
          <p style="margin:0 0 18px;font-size:14px;color:#e8e0d0">${name} &lt;${email}&gt;</p>
          ${subj ? `
          <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8974a">Subject</p>
          <p style="margin:0 0 18px;font-size:14px;color:#e8e0d0">${subj}</p>` : ''}
          <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8974a">Message</p>
          <p style="margin:0;font-size:14px;color:#9a9587;line-height:1.75;white-space:pre-wrap">${message}</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 0 28px">
      <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subj || 'Your message to JAYL')}"
         style="display:inline-block;background:#b8974a;color:#0c0c0c;font-size:11px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;padding:13px 28px">
        Reply to ${name}
      </a>
    </td></tr>`

  return {
    subject: `JAYL contact: ${subj || name}`,
    html:    htmlWrapper(body),
  }
}

// ── Template: contact form auto-reply (to customer) ───────────────────────────

export function buildContactAutoReplyEmail({ name }) {
  const body = `
    <tr><td style="padding:28px 0 8px">
      <h1 style="margin:0;font-weight:400;font-size:26px;color:#e8e0d0">We got your message.</h1>
    </td></tr>
    <tr><td style="padding:0 0 28px">
      <p style="margin:0 0 14px;font-size:15px;color:#9a9587;line-height:1.75">
        Hi ${name},
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#9a9587;line-height:1.75">
        Thanks for reaching out — we'll get back to you within 48 hours.
      </p>
      <p style="margin:0;font-size:13px;color:#4a4a4a">
        — The JAYL team
      </p>
    </td></tr>`

  return {
    subject: 'We received your message — JAYL',
    html:    htmlWrapper(body),
  }
}

// ── Resend sender ─────────────────────────────────────────────────────────────

/**
 * Send an email via Resend.
 * Returns { ok: true } on success, { ok: false, error } on failure.
 * Never throws — email failures must not break the main order flow.
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to)
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     FROM_ADDRESS,
        to:       Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[email] Resend error', res.status, data)
      return { ok: false, error: data.message || `HTTP ${res.status}` }
    }
    console.log('[email] sent to', to, '| id:', data.id)
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[email] send failed:', err.message)
    return { ok: false, error: err.message }
  }
}

export const STORE_EMAIL_ADDRESS = STORE_EMAIL
