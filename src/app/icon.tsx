import { ImageResponse } from 'next/og';

export const size = {
  width: 64,
  height: 64,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #07111f 0%, #0b1f3a 50%, #12396a 100%)',
          borderRadius: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 6,
            borderRadius: 12,
            border: '1px solid rgba(191, 219, 254, 0.18)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          }}
        />
        <div
          style={{
            display: 'flex',
            width: 36,
            height: 36,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <div style={{ width: 6, height: 12, borderRadius: 999, background: '#7dd3fc' }} />
          <div style={{ width: 6, height: 18, borderRadius: 999, background: '#93c5fd' }} />
          <div style={{ width: 6, height: 24, borderRadius: 999, background: '#bfdbfe' }} />
          <div style={{ width: 6, height: 30, borderRadius: 999, background: '#eff6ff' }} />
        </div>
        <div
          style={{
            position: 'absolute',
            width: 32,
            height: 3,
            borderRadius: 999,
            background: '#38bdf8',
            transform: 'translate(5px, 4px) rotate(-32deg)',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.45)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: 13,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: '#f8fafc',
            boxShadow: '0 0 18px rgba(248, 250, 252, 0.45)',
          }}
        />
      </div>
    ),
    size,
  );
}
