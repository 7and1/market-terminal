import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #08121f 0%, #0f2745 48%, #16508b 100%)',
          borderRadius: 42,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 14,
            borderRadius: 30,
            border: '2px solid rgba(191, 219, 254, 0.18)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          }}
        />
        <div
          style={{
            display: 'flex',
            width: 92,
            height: 92,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <div style={{ width: 16, height: 28, borderRadius: 999, background: '#7dd3fc' }} />
          <div style={{ width: 16, height: 44, borderRadius: 999, background: '#93c5fd' }} />
          <div style={{ width: 16, height: 58, borderRadius: 999, background: '#bfdbfe' }} />
          <div style={{ width: 16, height: 74, borderRadius: 999, background: '#eff6ff' }} />
        </div>
        <div
          style={{
            position: 'absolute',
            width: 86,
            height: 8,
            borderRadius: 999,
            background: '#38bdf8',
            transform: 'translate(13px, 10px) rotate(-32deg)',
            boxShadow: '0 0 28px rgba(56, 189, 248, 0.42)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 43,
            top: 37,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: '#f8fafc',
            boxShadow: '0 0 24px rgba(248, 250, 252, 0.42)',
          }}
        />
      </div>
    ),
    size,
  );
}
