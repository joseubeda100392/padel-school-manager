import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const S = 1.8 // scale: SVG 100→180px

function hole(cx: number, cy: number, r: number) {
  return {
    position: 'absolute' as const,
    left: (cx - r) * S,
    top: (cy - r) * S,
    width: r * 2 * S,
    height: r * 2 * S,
    borderRadius: '50%',
    background: 'rgba(10,18,32,0.5)',
    display: 'flex' as const,
  }
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #1b3050 0%, #0a1220 100%)',
          display: 'flex',
          position: 'relative',
        }}
      >
        {/* Racket head */}
        <div
          style={{
            position: 'absolute',
            left: 30 * S,
            top: 10 * S,
            width: 40 * S,
            height: 50 * S,
            borderRadius: 18 * S,
            background: 'linear-gradient(180deg, #05dca8 0%, #00a87c 100%)',
            display: 'flex',
          }}
        />
        {/* Handle */}
        <div
          style={{
            position: 'absolute',
            left: 42 * S,
            top: 57 * S,
            width: 16 * S,
            height: 26 * S,
            borderRadius: 6 * S,
            background: 'linear-gradient(180deg, #05dca8 0%, #00a87c 100%)',
            display: 'flex',
          }}
        />
        {/* Grip lines */}
        <div style={{ position: 'absolute', left: 42 * S, top: 63 * S, width: 16 * S, height: 2.5 * S, borderRadius: S, background: 'rgba(10,18,32,0.4)', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 42 * S, top: 69 * S, width: 16 * S, height: 2.5 * S, borderRadius: S, background: 'rgba(10,18,32,0.4)', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 42 * S, top: 75 * S, width: 16 * S, height: 2.5 * S, borderRadius: S, background: 'rgba(10,18,32,0.4)', display: 'flex' }} />
        {/* Holes */}
        <div style={hole(43, 22, 3)} />
        <div style={hole(57, 22, 3)} />
        <div style={hole(37, 32, 2.8)} />
        <div style={hole(50, 32, 2.8)} />
        <div style={hole(63, 32, 2.8)} />
        <div style={hole(37, 42, 2.8)} />
        <div style={hole(50, 42, 2.8)} />
        <div style={hole(63, 42, 2.8)} />
        <div style={hole(43, 52, 2.5)} />
        <div style={hole(57, 52, 2.5)} />
      </div>
    ),
    { ...size }
  )
}
