import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const S = 4.5 // scale from SVG 100px base

function racketDiv(offsetX: number, offsetY: number) {
  const hole = (cx: number, cy: number, r: number) => ({
    position: 'absolute' as const,
    left: offsetX + (cx - r) * S,
    top: offsetY + (cy - r) * S,
    width: r * 2 * S,
    height: r * 2 * S,
    borderRadius: '50%',
    background: 'rgba(10,18,32,0.45)',
    display: 'flex' as const,
  })

  return [
    // Head
    {
      position: 'absolute' as const,
      left: offsetX + 30 * S,
      top: offsetY + 10 * S,
      width: 40 * S,
      height: 50 * S,
      borderRadius: 18 * S,
      background: 'linear-gradient(180deg, #05dca8 0%, #00a87c 100%)',
      display: 'flex' as const,
    },
    // Handle
    {
      position: 'absolute' as const,
      left: offsetX + 42 * S,
      top: offsetY + 57 * S,
      width: 16 * S,
      height: 26 * S,
      borderRadius: 6 * S,
      background: 'linear-gradient(180deg, #05dca8 0%, #00a87c 100%)',
      display: 'flex' as const,
    },
    // Grip lines
    { position: 'absolute' as const, left: offsetX + 42 * S, top: offsetY + 63 * S, width: 16 * S, height: 2.5 * S, borderRadius: S, background: 'rgba(10,18,32,0.35)', display: 'flex' as const },
    { position: 'absolute' as const, left: offsetX + 42 * S, top: offsetY + 69 * S, width: 16 * S, height: 2.5 * S, borderRadius: S, background: 'rgba(10,18,32,0.35)', display: 'flex' as const },
    { position: 'absolute' as const, left: offsetX + 42 * S, top: offsetY + 75 * S, width: 16 * S, height: 2.5 * S, borderRadius: S, background: 'rgba(10,18,32,0.35)', display: 'flex' as const },
    // Holes
    hole(43, 22, 3), hole(57, 22, 3),
    hole(37, 32, 2.8), hole(50, 32, 2.8), hole(63, 32, 2.8),
    hole(37, 42, 2.8), hole(50, 42, 2.8), hole(63, 42, 2.8),
    hole(43, 52, 2.5), hole(57, 52, 2.5),
  ]
}

export default function OGImage() {
  const pieces = racketDiv(680, 40)

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: 'linear-gradient(135deg, #1b3050 0%, #0a1220 100%)',
          display: 'flex',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Accent bar left */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 6, height: 630, background: '#05dca8', display: 'flex' }} />

        {/* Text block */}
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 0,
            width: 620,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 0,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              background: 'rgba(5,220,168,0.12)',
              border: '1px solid rgba(5,220,168,0.3)',
              borderRadius: 999,
              padding: '8px 20px',
              marginBottom: 32,
            }}
          >
            <span style={{ color: '#05dca8', fontSize: 18, fontWeight: 600, letterSpacing: 1 }}>
              epadelschool.app
            </span>
          </div>

          {/* Title */}
          <div style={{ color: '#ffffff', fontSize: 80, fontWeight: 800, lineHeight: 1, letterSpacing: -2, display: 'flex' }}>
            ePadel
          </div>
          <div style={{ color: '#05dca8', fontSize: 80, fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginBottom: 28, display: 'flex' }}>
            School
          </div>

          {/* Description */}
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 26, lineHeight: 1.5, fontWeight: 400, display: 'flex' }}>
            La plataforma digital para gestionar tu escuela de pádel
          </div>
        </div>

        {/* Racket pieces */}
        {pieces.map((style, i) => (
          <div key={i} style={style} />
        ))}
      </div>
    ),
    { ...size }
  )
}
