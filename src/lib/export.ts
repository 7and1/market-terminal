/**
 * Client-side export utilities for graph screenshots and evidence data.
 */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportGraphPng(canvas: HTMLCanvasElement | null, topic: string) {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const safeName = topic.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-');
    downloadBlob(blob, `trendanalysis-${safeName}-graph.png`);
  }, 'image/png');
}

type EvidenceRow = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment?: string;
  confidence?: number;
  excerpt?: string;
  bullets?: string;
};

function evidenceToRows(evidence: Array<Record<string, unknown>>): EvidenceRow[] {
  return evidence.map((ev) => {
    const ai = (ev.aiSummary ?? {}) as Record<string, unknown>;
    return {
      id: String(ev.id ?? ''),
      title: String(ev.title ?? ''),
      url: String(ev.url ?? ''),
      source: String(ev.source ?? ''),
      publishedAt: Number(ev.publishedAt ?? 0),
      sentiment: String(ai.sentiment ?? ''),
      confidence: Number(ai.confidence ?? 0),
      excerpt: String(ev.excerpt ?? ''),
      bullets: Array.isArray(ai.bullets) ? ai.bullets.join(' | ') : '',
    };
  });
}

export function exportEvidenceCsv(evidence: Array<Record<string, unknown>>, topic: string) {
  const rows = evidenceToRows(evidence);
  const headers = ['id', 'title', 'url', 'source', 'publishedAt', 'sentiment', 'confidence', 'excerpt', 'bullets'];
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = String(row[h as keyof EvidenceRow] ?? '');
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const safeName = topic.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-');
  downloadBlob(blob, `trendanalysis-${safeName}-evidence.csv`);
}

export function exportEvidenceJson(evidence: Array<Record<string, unknown>>, topic: string) {
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
  const safeName = topic.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-');
  downloadBlob(blob, `trendanalysis-${safeName}-evidence.json`);
}
