'use client';

import { BarChart3, BookOpen, ChevronDown, ChevronUp, Clapperboard, Globe, Newspaper } from 'lucide-react';

import { cn } from '@/lib/utils';
import { MediaPanel } from '@/components/terminal/MediaPanel';
import { NarrativesPanel } from '@/components/terminal/NarrativesPanel';
import { PricePanel } from '@/components/terminal/PricePanel';
import { SourcesPanel } from '@/components/terminal/SourcesPanel';
import { TapePanel } from '@/components/terminal/TapePanel';
import type { PriceResponse, PriceScaleMode, VideosResponse } from '@/components/terminal/model';

export type InsightPanelKey = 'tape' | 'sources' | 'narratives' | 'price' | 'media';

const PANEL_META: Record<InsightPanelKey, { label: string; icon: typeof Newspaper }> = {
  tape: { label: 'Breaking Tape', icon: Newspaper },
  sources: { label: 'Sources', icon: Globe },
  narratives: { label: 'Narratives', icon: BookOpen },
  price: { label: 'Price Context', icon: BarChart3 },
  media: { label: 'Media', icon: Clapperboard },
};

export function InsightPanels({
  activePanel,
  onActivePanelChange,
  session,
  isEmpty,
  sourceStats,
  tapeStats,
  narrativeStats,
  price,
  priceLoading,
  priceScaleMode,
  priceCompareTopic,
  priceCompare,
  priceCompareLoading,
  videos,
  videosLoading,
  videoAutoPoll,
  activeVideoId,
  onOpenEvidence,
  onRefreshPrice,
  onRefreshMedia,
  onScaleModeChange,
  onCompareTopicChange,
  onVideoAutoPollChange,
  onActiveVideoChange,
}: {
  activePanel: InsightPanelKey;
  onActivePanelChange: (key: InsightPanelKey) => void;
  session: {
    topic: string;
    series: number[];
    seriesTs: number[];
    tape: Array<{ id: string; title: string; source: string; publishedAt: number; tags: string[]; evidenceId: string }>;
    clusters: Array<{ id: string; title: string; summary: string; momentum: 'rising' | 'steady' | 'fading'; evidenceIds: string[]; related: string[] }>;
    evidence: Array<{ id: string; source: string; publishedAt: number; title: string }>;
  } | null;
  isEmpty: boolean;
  sourceStats: Array<{ source: string; count: number; latestAt: number; latestKind: 'published' | 'observed' }>;
  tapeStats: {
    headlineCount: number;
    uniqueSourceCount: number;
    evidenceCount: number;
  };
  narrativeStats: { count: number; rising: number; steady: number; fading: number };
  price: PriceResponse | null;
  priceLoading: boolean;
  priceScaleMode: PriceScaleMode;
  priceCompareTopic: string | null;
  priceCompare: PriceResponse | null;
  priceCompareLoading: boolean;
  videos: VideosResponse | null;
  videosLoading: boolean;
  videoAutoPoll: boolean;
  activeVideoId: string | null;
  onOpenEvidence: (title: string, evidenceIds: string[]) => void;
  onRefreshPrice: () => void;
  onRefreshMedia: () => void;
  onScaleModeChange: (value: PriceScaleMode) => void;
  onCompareTopicChange: (value: string | null) => void;
  onVideoAutoPollChange: (value: boolean) => void;
  onActiveVideoChange: (id: string) => void;
}) {
  const panelKeys = Object.keys(PANEL_META) as InsightPanelKey[];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {panelKeys.map((key) => {
          const icon = PANEL_META[key].icon;
          const Icon = icon;
          const active = activePanel === key;
          return (
            <button
              key={key}
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                active
                  ? 'border-white/20 bg-white/[0.08] text-white/88'
                  : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]',
              )}
              onClick={() => onActivePanelChange(key)}
            >
              {active ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <Icon className="h-3.5 w-3.5" />
              {PANEL_META[key].label}
            </button>
          );
        })}
      </div>

      {activePanel === 'tape' ? (
        <TapePanel
          isEmpty={isEmpty}
          tape={session?.tape ?? []}
          tapeStats={tapeStats}
          onOpenEvidence={onOpenEvidence}
        />
      ) : null}

      {activePanel === 'sources' ? (
        <SourcesPanel
          isEmpty={isEmpty}
          sourceStats={sourceStats}
          evidence={(session?.evidence ?? []).map((item) => ({ id: item.id, source: item.source }))}
          onOpenEvidence={onOpenEvidence}
        />
      ) : null}

      {activePanel === 'narratives' ? (
        <NarrativesPanel
          isEmpty={isEmpty}
          clusters={session?.clusters ?? []}
          narrativeStats={narrativeStats}
          onOpenEvidence={onOpenEvidence}
        />
      ) : null}

      {activePanel === 'price' ? (
        <PricePanel
          session={session ? { topic: session.topic, series: session.series, seriesTs: session.seriesTs } : null}
          price={price}
          priceLoading={priceLoading}
          priceScaleMode={priceScaleMode}
          priceCompareTopic={priceCompareTopic}
          priceCompare={priceCompare}
          priceCompareLoading={priceCompareLoading}
          evidence={(session?.evidence ?? []).map((item) => ({
            id: item.id,
            publishedAt: item.publishedAt,
            title: item.title,
          }))}
          onRefresh={onRefreshPrice}
          onScaleModeChange={onScaleModeChange}
          onCompareTopicChange={onCompareTopicChange}
        />
      ) : null}

      {activePanel === 'media' ? (
        <MediaPanel
          session={session ? { topic: session.topic } : null}
          videos={videos}
          videosLoading={videosLoading}
          videoAutoPoll={videoAutoPoll}
          activeVideoId={activeVideoId}
          onVideoAutoPollChange={onVideoAutoPollChange}
          onRefresh={onRefreshMedia}
          onActiveVideoChange={onActiveVideoChange}
        />
      ) : null}
    </div>
  );
}
