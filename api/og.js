/**
 * api/og.js  →  GET /api/og
 *
 * Generates branded Open Graph images (1200×630 PNG) using @vercel/og.
 * Used as og:image for the homepage and product pages.
 *
 * Query params:
 *   title    — Main text (e.g. product name)
 *   subtitle — Secondary text (e.g. collection name)
 *   image    — Absolute URL of product image to embed on the right
 *
 * Examples:
 *   /api/og                                         → default JAYL brand image
 *   /api/og?title=Charizard+T-Shirt&subtitle=Cool+Pokémon&image=https://...
 */

import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

export default function handler(req) {
  try {
    const { searchParams } = new URL(req.url)
    const title    = searchParams.get('title')    || 'Art & Wearable Art'
    const subtitle = searchParams.get('subtitle') || null
    const imageUrl = searchParams.get('image')    || null

    return new ImageResponse(
      {
        type: 'div',
        props: {
          style: {
            background: '#0a0a0a',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            position: 'relative',
            overflow: 'hidden',
          },
          children: [
            // Left: text block
            {
              type: 'div',
              props: {
                style: {
                  flex: imageUrl ? '0 0 62%' : '1',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '60px 64px',
                },
                children: [
                  // JAYL wordmark
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 13,
                        letterSpacing: '0.4em',
                        textTransform: 'uppercase',
                        color: '#c8b89a',
                        marginBottom: 32,
                        fontFamily: 'serif',
                      },
                      children: 'JAYL',
                    },
                  },
                  // Main title
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: title.length > 30 ? 38 : 52,
                        fontWeight: 300,
                        color: '#f0ece4',
                        lineHeight: 1.2,
                        fontFamily: 'serif',
                        marginBottom: subtitle ? 16 : 0,
                      },
                      children: title,
                    },
                  },
                  // Subtitle / collection
                  subtitle && {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 16,
                        color: '#888',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        fontFamily: 'sans-serif',
                      },
                      children: subtitle,
                    },
                  },
                  // Divider
                  {
                    type: 'div',
                    props: {
                      style: {
                        width: 48,
                        height: 1,
                        background: '#c8b89a',
                        marginTop: 40,
                        opacity: 0.5,
                      },
                    },
                  },
                  // Domain
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 13,
                        color: '#555',
                        marginTop: 14,
                        letterSpacing: '0.06em',
                        fontFamily: 'sans-serif',
                      },
                      children: 'jayl.store',
                    },
                  },
                ].filter(Boolean),
              },
            },
            // Right: product image (optional)
            imageUrl && {
              type: 'div',
              props: {
                style: {
                  flex: '0 0 38%',
                  display: 'flex',
                  alignItems: 'stretch',
                  overflow: 'hidden',
                  position: 'relative',
                },
                children: [
                  // Gradient overlay on left edge of image
                  {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: 0, top: 0, bottom: 0,
                        width: 80,
                        background: 'linear-gradient(to right, #0a0a0a, transparent)',
                        zIndex: 1,
                      },
                    },
                  },
                  {
                    type: 'img',
                    props: {
                      src: imageUrl,
                      style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                      },
                    },
                  },
                ],
              },
            },
          ].filter(Boolean),
        },
      },
      {
        width:  1200,
        height: 630,
      }
    )
  } catch (err) {
    console.error('[og] error:', err)
    return new Response('OG image generation failed', { status: 500 })
  }
}
