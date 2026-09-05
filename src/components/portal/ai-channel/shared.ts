import type { RouterOutputs } from '@/components/portal/dashboard/shared';

/** AI Channel Analytics payload types (inferred from the tRPC router). */
export type Summary = RouterOutputs['analytics']['aiChannelSummary'];
export type Timeseries = RouterOutputs['analytics']['aiChannelTimeseries'];
export type TopPages = RouterOutputs['analytics']['aiChannelTopPages'];
export type Visits = RouterOutputs['analytics']['aiChannelVisits'];
export type IngestConnection = RouterOutputs['analytics']['ingestConnection'];

export type BotClass = 'training_crawl' | 'citation_fetch' | 'referral_visit';

/** Brand palette v2 class colors (design tokens). */
export const CLASS_COLORS: Record<BotClass, string> = {
  training_crawl: '#3289AE', // Editorial Blue
  citation_fetch: '#83D6FA', // Signal Blue
  referral_visit: '#BDEAFF', // Icy Blue
};

export const CLASS_LABELS: Record<BotClass, string> = {
  training_crawl: 'Training crawls',
  citation_fetch: 'Citation fetches',
  referral_visit: 'AI referrals',
};

export const CLASS_DESCRIPTIONS: Record<BotClass, string> = {
  training_crawl: 'AI engines learning your content (GPTBot, ClaudeBot, PerplexityBot…)',
  citation_fetch: 'Live fetches during real conversations (ChatGPT-User, Claude-User…)',
  referral_visit: 'Humans clicking AI citations (chatgpt.com, perplexity.ai…)',
};
