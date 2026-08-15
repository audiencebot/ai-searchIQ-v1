/**
 * Shared types for the Ask AI Search IQ copilot (ask.md).
 * Shapes mirror the ask router payload (api/ask-router.ts).
 */

export type CitationRef = { label: string; path: string };

export type AnswerKind = 'answer' | 'refusal' | 'insufficient';

export type ChatMessage =
  | {
      id: string;
      role: 'user';
      text: string;
      at: Date;
    }
  | {
      id: string;
      role: 'assistant';
      kind: AnswerKind;
      text: string;
      citations: CitationRef[];
      followUps: string[];
      at: Date;
      feedback?: 'up' | 'down';
    };

export type StarterPrompt = { id: number; question: string; category: string | null };

export type HistoryItem = { id: number; title: string; date: Date | string };

let seq = 0;
export function nextMessageId(): string {
  seq += 1;
  return `msg-${Date.now()}-${seq}`;
}
