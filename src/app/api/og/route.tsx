import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const topic = searchParams.get('topic') || 'Market Analysis';
  const evidence = searchParams.get('evidence') || '0';
  const clusters = searchParams.get('clusters') || '0';
  const mode = searchParams.get('mode') || 'fast';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          background:
            'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0f1a 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top gradient bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background:
              'linear-gradient(90deg, #0066ff, #ff521c, #14b8a6)',
          }}
        />

        {/* Content */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase' as const,
            }}
          >
            Evidence-First Market Research
          </div>
          <div
            style={{
              fontSize: topic.length > 40 ? '36px' : '48px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.92)',
              lineHeight: 1.2,
              maxWidth: '900px',
            }}
          >
            {topic}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {evidence} sources
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {clusters} clusters
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '999px',
                border: `1px solid ${mode === 'deep' ? 'rgba(0,102,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
                background:
                  mode === 'deep'
                    ? 'rgba(0,102,255,0.12)'
                    : 'rgba(255,255,255,0.05)',
                fontSize: '14px',
                color:
                  mode === 'deep'
                    ? 'rgba(173,212,255,0.95)'
                    : 'rgba(255,255,255,0.7)',
              }}
            >
              {mode === 'deep' ? 'Deep Analysis' : 'Fast Analysis'}
            </div>
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            TrendAnalysis.ai
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
