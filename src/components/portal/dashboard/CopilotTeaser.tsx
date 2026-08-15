import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { Reveal } from './shared';

const SUGGESTED_QUESTION = 'Why did my score improve this month?';

/** S6 — full-width dark copilot teaser strip. */
export function CopilotTeaser() {
  return (
    <Reveal
      delay={0.3}
      className="flex flex-wrap items-center justify-between gap-4 rounded-ares bg-ares-tertiary p-6"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Icon icon={icons.chatRoundDots} width={20} height={20} className="shrink-0 text-ares-primary" />
        <p className="font-display text-[16px] text-white">Ask AI Search IQ</p>
        <Link
          to={`/app/ask?q=${encodeURIComponent(SUGGESTED_QUESTION)}`}
          className="badge-pill border-white/15 bg-transparent text-on-dark transition-colors duration-200 hover:border-ares-primary hover:text-ares-primary"
        >
          {SUGGESTED_QUESTION}
        </Link>
      </div>
      <Link to="/app/ask" className="btn-primary shrink-0">
        Open copilot
      </Link>
    </Reveal>
  );
}
