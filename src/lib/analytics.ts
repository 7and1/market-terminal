// Client-side analytics helper — safe to call on server (no-ops)

type EventData = Record<string, string | number>;

declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: EventData) => void;
    };
  }
}

export function trackEvent(name: string, data?: EventData) {
  if (typeof window !== 'undefined' && window.umami) {
    window.umami.track(name, data);
  }
}
