'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { guessTopicFromQuery, isUuid, now } from '@/components/terminal/helpers';
import type { TerminalSharedState } from '@/components/terminal/hooks/useTerminalSharedState';
import { deriveContextFocusEvidenceIds, deriveReferenceContext } from '@/components/terminal/terminal-state';
import { apiPath } from '@/lib/utils';
import { asRecord } from '@/lib/session-data';
import type { EvidenceItem } from '@/lib/types';

export function useTerminalChatContext({
  store,
  tapeTagsByEvidenceId,
  selectedNodeId,
  selectedEdgeId,
  selectedTag,
  drawerEvidence,
  openEvidence,
  setSelectedNodeId,
  setSelectedEdgeId,
  setSelectedTag,
  start,
  running,
  snapshotReadOnly,
}: {
  store: TerminalSharedState;
  tapeTagsByEvidenceId: Map<string, string[]>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedTag: string | null;
  drawerEvidence: EvidenceItem[];
  openEvidence: (title: string, evidenceIds: string[], note?: string | null) => void;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>;
  setSelectedTag: Dispatch<SetStateAction<string | null>>;
  start: (rawTopic: string, question?: string) => Promise<void>;
  running: boolean;
  snapshotReadOnly: boolean;
}) {
  const autoBriefSentRef = useRef<string | null>(null);
  const autoBriefInFlightRef = useRef(false);
  const { session, topic, chatInput, messages, setChatMode, setMessages, setChatInput, setTopic } = store;

  useEffect(() => {
    if (!session) return;
    setChatMode('explain');
  }, [session, setChatMode]);

  const referenceContext = useMemo(
    () =>
      deriveReferenceContext({
        selectedNodeId,
        selectedEdgeId,
        selectedTag,
        drawerEvidence,
      }),
    [drawerEvidence, selectedEdgeId, selectedNodeId, selectedTag],
  );

  const tagOptions = useMemo(() => {
    if (!session) return [] as string[];
    const tags = new Set<string>();
    for (const item of session.tape || []) {
      for (const raw of item.tags || []) {
        const value = String(raw || '').trim();
        if (value) tags.add(value);
      }
    }
    for (const item of session.evidence || []) {
      for (const raw of item.aiSummary?.catalysts || []) {
        const value = String(raw || '').trim();
        if (value) tags.add(value);
      }
    }
    return Array.from(tags).slice(0, 22);
  }, [session]);

  const mentionState = useMemo(() => {
    const match = chatInput.match(/@([a-zA-Z0-9_-]*)$/);
    if (!match) return { active: false, query: '', items: [] as string[] };
    const query = (match[1] || '').toLowerCase();
    const nodeIds = (session?.nodes || []).map((node) => node.id);
    const evidenceIds = (session?.evidence || []).map((item) => item.id);
    const items = Array.from(new Set([...nodeIds, ...evidenceIds, ...tagOptions]))
      .filter((value) => value.toLowerCase().includes(query))
      .slice(0, 12);
    return { active: true, query, items };
  }, [chatInput, session?.evidence, session?.nodes, tagOptions]);

  const showChatSuggestions = useMemo(
    () => !running && !messages.some((message) => message.role === 'user'),
    [messages, running],
  );

  const runChat = useCallback(
    (query: string) => {
      const cleaned = query.trim();
      if (!cleaned) return;
      const inferred = guessTopicFromQuery(cleaned);
      const topicForRun = inferred || (session ? topic : cleaned);
      setMessages((prev) => [
        ...prev,
        { id: `m_${Math.random().toString(16).slice(2)}`, role: 'user', content: cleaned, createdAt: now() },
      ]);
      setChatInput('');
      setTopic(topicForRun);
      void start(topicForRun, cleaned).catch(() => undefined);
    },
    [session, setChatInput, setMessages, setTopic, start, topic],
  );

  const askWithContext = useCallback(
    async (query: string, opts?: { focusEvidenceIds?: string[] }) => {
      const cleaned = query.trim();
      if (!cleaned) return;
      if (!session || !isUuid(session.id)) {
        runChat(cleaned);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: `m_${Math.random().toString(16).slice(2)}`, role: 'user', content: cleaned, createdAt: now() },
      ]);
      setChatInput('');

      const effectiveFocus = deriveContextFocusEvidenceIds({
        query: cleaned,
        extraEvidenceIds: opts?.focusEvidenceIds || [],
        evidence: session.evidence,
        edges: session.edges,
        tapeTagsByEvidenceId,
      });

      try {
        const res = await fetch(apiPath('/api/chat'), {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.id,
            message: cleaned,
            ...(effectiveFocus.length ? { focusEvidenceIds: effectiveFocus } : null),
          }),
        });
        const data = asRecord(await res.json().catch(() => ({})));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Chat failed (${res.status})`);
        const content = typeof data.content === 'string' ? data.content.trim() : '';
        setMessages((prev) => [
          ...prev,
          { id: `m_${Math.random().toString(16).slice(2)}`, role: 'assistant', content: content || 'No response.', createdAt: now() },
        ]);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Chat failed';
        setMessages((prev) => [
          ...prev,
          { id: `m_${Math.random().toString(16).slice(2)}`, role: 'assistant', content: `Error: ${message}`, createdAt: now() },
        ]);
      }
    },
    [runChat, session, setChatInput, setMessages, tapeTagsByEvidenceId],
  );

  const fetchAutoBrief = useCallback(
    async (opts: { sessionId: string; topic: string; focusEvidenceIds: string[] }) => {
      if (!isUuid(opts.sessionId)) return;
      if (autoBriefInFlightRef.current) return;
      autoBriefInFlightRef.current = true;
      try {
        const res = await fetch(apiPath('/api/chat'), {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: opts.sessionId,
            message: `Give a short paragraph (3-5 sentences, no bullets) explaining what is happening with ${opts.topic} right now. Cite evidence IDs like [ev_3].`,
            ...(opts.focusEvidenceIds.length ? { focusEvidenceIds: opts.focusEvidenceIds.slice(0, 24) } : null),
          }),
        });
        const data = asRecord(await res.json().catch(() => ({})));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Brief failed (${res.status})`);
        const content = typeof data.content === 'string' ? data.content.trim() : '';
        if (!content) return;
        setMessages((prev) => [
          ...prev,
          { id: `m_${Math.random().toString(16).slice(2)}`, role: 'assistant', content: `Brief: ${content}`, createdAt: now() },
        ]);
      } catch {
        // silent failure
      } finally {
        autoBriefInFlightRef.current = false;
      }
    },
    [setMessages],
  );

  useEffect(() => {
    if (!session || !isUuid(session.id)) return;
    if (snapshotReadOnly) return;
    if (running) return;
    if (session.step !== 'ready') return;
    if (!session.evidence.length) return;
    if (autoBriefSentRef.current === session.id) return;

    autoBriefSentRef.current = session.id;
    const focusEvidenceIds = Array.from(
      new Set((session.tape || []).map((item) => String(item.evidenceId || '')).filter(Boolean)),
    ).slice(0, 24);
    void fetchAutoBrief({
      sessionId: session.id,
      topic: session.topic,
      focusEvidenceIds,
    });
  }, [fetchAutoBrief, running, session, snapshotReadOnly]);

  const renderMessageContent = useCallback(
    (content: string) => {
      const parts = content.split(/(\[[^\]]{1,64}\])/g).filter(Boolean);
      return parts.map((part, idx) => {
        const match = part.match(/^\[([^\]]{1,64})\]$/);
        if (!match) return <span key={`txt_${idx}`}>{part}</span>;
        const token = match[1] || '';

        if (/^ev_[a-z0-9_:-]+$/i.test(token)) {
          return (
            <button
              key={`tok_${idx}`}
              type="button"
              className="mx-0.5 inline-flex rounded-full border border-[rgba(20,184,166,0.4)] bg-[rgba(20,184,166,0.14)] px-2 py-0.5 text-[11px] text-[rgba(170,250,238,0.96)]"
              onClick={() => openEvidence(`Evidence: ${token}`, [token])}
            >
              [{token}]
            </button>
          );
        }

        if (/^n_[a-z0-9_:-]+$/i.test(token)) {
          return (
            <button
              key={`tok_${idx}`}
              type="button"
              className="mx-0.5 inline-flex rounded-full border border-[rgba(0,102,255,0.45)] bg-[rgba(0,102,255,0.14)] px-2 py-0.5 text-[11px] text-[rgba(170,209,255,0.96)]"
              onClick={() => {
                setSelectedNodeId(token);
                setSelectedEdgeId(null);
              }}
            >
              [{token}]
            </button>
          );
        }

        return (
          <button
            key={`tok_${idx}`}
            type="button"
            className="mx-0.5 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/72"
            onClick={() => setSelectedTag(token)}
          >
            [{token}]
          </button>
        );
      });
    },
    [openEvidence, setSelectedEdgeId, setSelectedNodeId, setSelectedTag],
  );

  return {
    referenceContext,
    mentionState,
    showChatSuggestions,
    runChat,
    askWithContext,
    renderMessageContent,
  };
}
