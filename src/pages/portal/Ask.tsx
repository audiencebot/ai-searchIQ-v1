import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { Toaster } from '@/components/ui/sonner';
import { trpc } from '@/providers/trpc';
import AssistantMessage, { TypingIndicator } from '@/components/portal/ask/AssistantMessage';
import Composer from '@/components/portal/ask/Composer';
import HistoryRail from '@/components/portal/ask/HistoryRail';
import StarterGrid from '@/components/portal/ask/StarterGrid';
import { nextMessageId } from '@/components/portal/ask/types';
import type { ChatMessage, HistoryItem } from '@/components/portal/ask/types';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Minimum visible typing time so the three-dot pulse reads deliberately. */
const MIN_TYPING_MS = 900;

/**
 * Ask AI Search IQ — the full-page conversational copilot (ask.md).
 * Two-pane layout: 280px conversation-history rail + active conversation.
 * Answers come from the ask router's deterministic, tenant-scoped grounded
 * fixtures; cross-tenant probes and unmatched questions render explicit
 * refusal / insufficient-data states.
 */
export default function Ask() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startersQuery = trpc.ask.starters.useQuery();
  const historyQuery = trpc.ask.history.useQuery();
  const statusQuery = trpc.bootstrap.status.useQuery();
  const askMutation = trpc.ask.ask.useMutation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null);
  const [dismissedHistoryIds, setDismissedHistoryIds] = useState<number[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const handledInitialQuery = useRef(false);

  const tenantName = statusQuery.data?.tenant.name ?? 'Northwind Advisory';
  const historyItems = useMemo(
    () => (historyQuery.data ?? []).filter((h) => !dismissedHistoryIds.includes(h.id)),
    [historyQuery.data, dismissedHistoryIds]
  );

  const scrollToBottom = useCallback(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const send = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q || typing) return;
      setMessages((prev) => [...prev, { id: nextMessageId(), role: 'user', text: q, at: new Date() }]);
      setTyping(true);
      const startedAt = Date.now();
      askMutation.mutate(
        { question: q },
        {
          onSuccess: (res) => {
            const wait = Math.max(0, MIN_TYPING_MS - (Date.now() - startedAt));
            window.setTimeout(() => {
              setMessages((prev) => [
                ...prev,
                {
                  id: nextMessageId(),
                  role: 'assistant',
                  kind: res.kind,
                  text: res.answerText,
                  citations: res.citationRefs,
                  followUps: res.followUps,
                  at: new Date(),
                },
              ]);
              setTyping(false);
            }, wait);
          },
          onError: () => {
            setTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                id: nextMessageId(),
                role: 'assistant',
                kind: 'insufficient',
                text: 'Something went wrong reaching your data. Please try again.',
                citations: [],
                followUps: [],
                at: new Date(),
              },
            ]);
          },
        }
      );
    },
    [askMutation, typing]
  );

  // ask.md §S1 — `?q=` deep links (dashboard / action plan) pre-send a question.
  useEffect(() => {
    if (handledInitialQuery.current) return;
    const q = searchParams.get('q');
    if (q && q.trim()) {
      handledInitialQuery.current = true;
      setSearchParams({}, { replace: true });
      send(q);
    }
  }, [searchParams, setSearchParams, send]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  const startNewConversation = () => {
    setMessages([]);
    setTyping(false);
    setActiveHistoryId(null);
  };

  const openHistoryItem = (item: HistoryItem) => {
    setActiveHistoryId(item.id);
    setMessages([]);
    send(item.title);
  };

  const setFeedback = (id: string, feedback: 'up' | 'down') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, feedback } : m))
    );
  };

  const isEmpty = messages.length === 0 && !typing;

  return (
    <div className="flex h-[calc(100dvh-56px-48px)] gap-6 lg:h-[calc(100dvh-56px-64px)]">
      <Toaster position="bottom-right" />
      {/* Left rail — conversation history */}
      <aside className="hidden w-[280px] shrink-0 overflow-hidden rounded-ares border border-ares-border bg-ares-card md:block">
        <HistoryRail
          items={historyItems}
          activeId={activeHistoryId}
          onSelect={openHistoryItem}
          onNew={startNewConversation}
          onDelete={(id) => setDismissedHistoryIds((prev) => [...prev, id])}
        />
      </aside>

      {/* Right pane — active conversation */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-ares border border-ares-border bg-ares-surface">
        <div ref={threadRef} className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex h-full items-center justify-center">
              {startersQuery.isLoading ? (
                <p className="text-[11px] font-light text-ares-muted">Loading starter prompts…</p>
              ) : (
                <StarterGrid
                  starters={startersQuery.data ?? []}
                  tenantName={tenantName}
                  onPick={send}
                />
              )}
            </div>
          ) : (
            <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-5 py-6">
              {messages.map((m) =>
                m.role === 'user' ? (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="flex justify-end"
                  >
                    <div className="max-w-[75%] rounded-ares bg-ares-secondary px-3.5 py-2.5 text-[12px] font-light leading-5 text-ares-text">
                      {m.text}
                    </div>
                  </motion.div>
                ) : (
                  <AssistantMessage
                    key={m.id}
                    message={m}
                    onFeedback={setFeedback}
                    onFollowUp={send}
                  />
                )
              )}
              {typing && <TypingIndicator />}
            </div>
          )}
        </div>
        <Composer disabled={typing || askMutation.isPending} onSend={send} />
      </section>
    </div>
  );
}
