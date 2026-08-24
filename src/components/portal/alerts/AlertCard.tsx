import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../api/router';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type AlertRow = RouterOutputs['alerts']['list'][number];
type AlertStatus = AlertRow['status'];

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
  ai_overviews: 'Google AI Overviews',
  ai_search: 'AI Search',
};

export const SEVERITY_META = {
  high: {
    label: 'High',
    icon: icons.dangerTriangle,
    iconClass: 'text-ares-primary',
    barClass: 'bg-ares-primary',
    borderClass: 'border-l-ares-primary',
  },
  medium: {
    label: 'Medium',
    icon: icons.infoCircle,
    iconClass: 'text-ares-severityMedium',
    barClass: 'bg-ares-severityMedium',
    borderClass: 'border-l-ares-severityMedium',
  },
  low: {
    label: 'Low',
    icon: icons.handMoney,
    iconClass: 'text-ares-muted',
    barClass: 'bg-ares-muted',
    borderClass: 'border-l-ares-muted',
  },
} as const;

const STATUS_BADGE: Record<AlertStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'border-ares-primaryDark/40 text-ares-primaryDark' },
  in_progress: { label: 'Fix in progress', className: 'border-ares-primary/40 text-ares-primary' },
  resolved: { label: 'Pending verification', className: 'border-ares-primary/40 text-ares-primary' },
  verified: { label: 'Resolved', className: 'text-ares-muted' },
};

/** Design stepper (alerts.md §S3) mapped onto the enforced backend lifecycle
 *  open → in_progress → resolved → verified. Backward moves are rejected by
 *  the API, so the UI only ever offers the next forward step. */
const STEPS = ['Open', 'Acknowledged', 'Fix in progress', 'Pending verification', 'Resolved'];
const STEP_INDEX: Record<AlertStatus, number> = {
  open: 0,
  in_progress: 2,
  resolved: 3,
  verified: 4,
};

function initials(name: string) {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function StatusStepper({ status }: { status: AlertStatus }) {
  const current = STEP_INDEX[status];
  return (
    <div className="flex items-center" aria-label={`Status: ${STATUS_BADGE[status].label}`}>
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          {i > 0 && (
            <motion.span
              className={cn('h-[2px] w-4 sm:w-6', i <= current ? 'bg-ares-primary' : 'bg-ares-border')}
              initial={false}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          <span
            title={step}
            className={cn(
              'h-2 w-2 rounded-full border transition-colors duration-300',
              i <= current ? 'border-ares-primary bg-ares-primary' : 'border-ares-border bg-ares-card'
            )}
          />
        </div>
      ))}
      <span className="ml-2 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
        {STEPS[current]}
      </span>
    </div>
  );
}

export default function AlertCard({
  alert,
  index,
  members,
  assignee,
  advancing,
  onAdvance,
  onAssign,
  onPendingVerification,
}: {
  alert: AlertRow;
  index: number;
  members: string[];
  assignee?: string | null;
  advancing: boolean;
  onAdvance: (id: number, next: AlertStatus) => void;
  onAssign: (id: number, name: string) => void;
  onPendingVerification: (title: string) => void;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [notes, setNotes] = useState<string[]>([]);

  const sev = SEVERITY_META[alert.severity];
  const badge = STATUS_BADGE[alert.status];
  const shownAssignee = assignee ?? alert.assignee;
  const prompts = alert.triggeringPrompts ?? [];
  const evidenceCount = alert.enginesAffected.length;

  const advance = (next: AlertStatus) => {
    if (next === 'resolved') onPendingVerification(alert.title);
    onAdvance(alert.id, next);
  };

  return (
    <motion.article
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-ares border border-ares-border border-l-[3px] bg-ares-card p-5 transition-shadow duration-200 hover:shadow-paper',
        sev.borderClass
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Icon icon={sev.icon} width={18} height={18} className={cn('shrink-0', sev.iconClass)} />
        <span className="font-label text-ares-secondarytext">{alert.title}</span>
        <span className={cn('badge-pill ml-auto', badge.className)}>{badge.label}</span>
      </div>

      {/* Body */}
      <p className="mt-3 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
        {alert.description}
      </p>

      {/* Fact comparison */}
      {alert.aiClaim && alert.groundTruth && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-ares border border-ares-border p-3">
            <p className="font-label text-[10px] text-ares-muted">AI claims</p>
            <p className="mt-1 text-[13px] font-normal text-ares-secondarytext">{alert.aiClaim}</p>
          </div>
          <div className="rounded-ares border border-ares-border p-3">
            <p className="font-label text-[10px] text-ares-primary">
              Ground truth{alert.groundTruth.includes('region') ? ' (GBP)' : ''}
            </p>
            <p className="mt-1 text-[13px] font-normal text-ares-secondarytext">
              {alert.groundTruth}
            </p>
          </div>
        </div>
      )}

      {/* Meta line */}
      <p className="mt-3 text-[10px] font-light text-ares-muted">
        Engines affected: {alert.enginesAffected.map((e) => ENGINE_LABEL[e] ?? e).join(', ')}
        {prompts.length > 0 && (
          <> · Triggering prompts: {prompts.map((p) => `'${p}'`).join(', ')}</>
        )}
        {alert.firstDetectedAt && (
          <> · First detected: {format(new Date(alert.firstDetectedAt), 'MMM dd')}</>
        )}
      </p>

      {/* Evidence accordion */}
      <div className="mt-3 border-t border-ares-border2 pt-3">
        <button
          className="flex items-center gap-2 text-[10px] font-light uppercase tracking-[0.08em] text-ares-link transition-colors duration-200 hover:text-ares-primary"
          onClick={() => setEvidenceOpen((v) => !v)}
          aria-expanded={evidenceOpen}
        >
          <Icon
            icon={icons.altArrowDown}
            width={12}
            height={12}
            className={cn('transition-transform duration-200', evidenceOpen && 'rotate-180')}
          />
          View raw responses ({evidenceCount})
        </button>
        <AnimatePresence initial={false}>
          {evidenceOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                {alert.enginesAffected.map((engine, i) => (
                  <div
                    key={engine}
                    className="rounded-ares border border-ares-border2 bg-ares-surface p-3"
                  >
                    <p className="font-label text-[10px] text-ares-muted">
                      {ENGINE_LABEL[engine] ?? engine}
                      {prompts.length > 0 && (
                        <span className="normal-case tracking-normal">
                          {' '}
                          · “{prompts[i % prompts.length]}”
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] font-light leading-[17px] text-ares-secondarytext">
                      {alert.aiClaim ? (
                        <>
                          Response excerpt states{' '}
                          <mark className="bg-ares-primary/10 px-0.5 text-ares-primary">
                            {alert.aiClaim}
                          </mark>{' '}
                          — contradicted by ground truth
                          {alert.groundTruth ? ` (${alert.groundTruth})` : ''}.
                        </>
                      ) : (
                        alert.description
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recommended fix */}
      {alert.recommendedFix && (
        <div className="mt-3 flex items-start gap-2.5 rounded-ares border border-ares-border bg-ares-primary/[0.04] p-3">
          <Icon
            icon={icons.checkCircle}
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-ares-primary"
          />
          <p className="text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
            {alert.recommendedFix}
            {alert.type === 'missing_pricing_signal' && (
              <>
                {' '}
                <Link
                  to="/app/action-plan"
                  className="inline-flex items-center gap-1 text-ares-link underline-offset-2 transition-colors duration-200 hover:text-ares-primary"
                >
                  View 30-day plan
                  <Icon icon={icons.arrowRight} width={11} height={11} />
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {/* Notes (local) */}
      {notes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {notes.map((note, i) => (
            <p key={i} className="flex items-start gap-2 text-[11px] font-light text-ares-muted">
              <Icon icon={icons.pen2} width={12} height={12} className="mt-0.5 shrink-0" />
              {note}
            </p>
          ))}
        </div>
      )}

      {/* Action row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-ares-border2 pt-4">
        <StatusStepper status={alert.status} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {alert.status === 'open' && (
            <button
              className="btn-primary !px-3 !py-1.5 text-[10px]"
              disabled={advancing}
              onClick={() => advance('in_progress')}
            >
              Acknowledge &amp; start fix
            </button>
          )}
          {alert.status === 'in_progress' && (
            <button
              className="btn-primary !px-3 !py-1.5 text-[10px]"
              disabled={advancing}
              onClick={() => advance('resolved')}
            >
              Mark fix deployed
            </button>
          )}
          {alert.status === 'resolved' && (
            <button
              className="btn-secondary !px-3 !py-1.5 text-[10px]"
              disabled={advancing}
              onClick={() => advance('verified')}
            >
              Mark verified
            </button>
          )}
          {alert.status === 'verified' && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-light uppercase tracking-[0.08em] text-ares-primary">
              <Icon icon={icons.checkCircle} width={13} height={13} />
              Verified by scan
            </span>
          )}

          {/* Assign */}
          <div className="relative">
            <button
              className="btn-secondary !px-3 !py-1.5 text-[10px]"
              onClick={() => setAssignOpen((v) => !v)}
            >
              Assign
            </button>
            <AnimatePresence>
              {assignOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-20 mt-1 w-44 rounded-ares border border-ares-border bg-ares-surface py-1 shadow-paper"
                >
                  {members.map((m) => (
                    <li key={m}>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-light text-ares-secondarytext transition-colors duration-150 hover:bg-ares-primary/[0.04] hover:text-ares-primary"
                        onClick={() => {
                          onAssign(alert.id, m);
                          setAssignOpen(false);
                        }}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ares-secondary text-[8px] font-normal text-ares-secondarytext">
                          {initials(m)}
                        </span>
                        {m}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <button
            className="inline-flex items-center gap-1.5 text-[10px] font-light uppercase tracking-[0.08em] text-ares-link transition-colors duration-200 hover:text-ares-primary"
            onClick={() => setNoteOpen((v) => !v)}
          >
            <Icon icon={icons.pen2} width={12} height={12} />
            Add note
          </button>
        </div>
      </div>

      {/* Assignee chip */}
      {shownAssignee && (
        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ares-tertiary text-[9px] font-normal tracking-[0.04em] text-white">
            {initials(shownAssignee)}
          </span>
          <span className="text-[10px] font-light text-ares-muted">
            Assigned: <span className="text-ares-secondarytext">{shownAssignee}</span>
          </span>
        </div>
      )}

      {/* Note editor */}
      <AnimatePresence initial={false}>
        {noteOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-ares border border-ares-border bg-ares-surface p-3">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                placeholder="Add context for the team…"
                className="w-full resize-none rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-secondarytext placeholder:text-ares-muted focus:border-ares-primary focus:outline-none"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  className="btn-secondary !px-3 !py-1.5 text-[10px]"
                  onClick={() => {
                    setNoteOpen(false);
                    setNoteDraft('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary !px-3 !py-1.5 text-[10px]"
                  disabled={!noteDraft.trim()}
                  onClick={() => {
                    setNotes((n) => [...n, noteDraft.trim()]);
                    setNoteDraft('');
                    setNoteOpen(false);
                  }}
                >
                  Save note
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
