import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0d1526',
          borderRadius: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 74,
            background: '#00c49a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: 'white',
              fontSize: 104,
              fontWeight: 900,
              lineHeight: 1,
              fontFamily: 'Arial Black, Arial, sans-serif',
              paddingTop: 10,
            }}
          >
            e
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
