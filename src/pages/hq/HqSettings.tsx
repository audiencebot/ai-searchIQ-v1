import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import PageHeader from '@/components/portal/alerts/PageHeader';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';

/**
 * HQ Settings (plan §6 screen 5, Phase 1 scope): email provider status and
 * the invite template preview. No secret inputs — the Resend key is env-only.
 */
export default function HqSettings() {
  const status = trpc.hq.emailStatus.useQuery();

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="HQ · Settings" title="Email & sender configuration" />

      {status.isLoading && <LoadingBlock rows={4} />}
      {status.error && <ErrorBlock message={status.error.message} onRetry={() => status.refetch()} />}

      {status.data && (
        <>
          <section className="rounded-ares border border-ares-border bg-ares-card p-5">
            <h3 className="font-display text-[15px]">Email provider — Resend</h3>
            <div className="mt-4 space-y-3 text-[12px] font-light text-ares-secondarytext">
              <p className="flex items-center gap-2">
                <Icon
                  icon={status.data.configured ? icons.checkCircle : icons.dangerTriangle}
                  width={16}
                  height={16}
                  className={status.data.configured ? 'text-ares-primary' : 'text-ares-primaryDark'}
                />
                {status.data.configured
                  ? 'RESEND_API_KEY is configured — emails send for real.'
                  : 'RESEND_API_KEY is not configured — sends are logged as pending in email_log, nothing goes out.'}
              </p>
              <p>
                <span className="font-label text-ares-muted">Sender address</span>
                <span className="mt-1 block text-ares-text">{status.data.from}</span>
              </p>
              <p className="text-[11px] text-ares-muted">
                Keys are environment-only (set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> in
                the server env). Nothing secret is ever entered or stored in HQ.
              </p>
            </div>
          </section>

          <section className="rounded-ares border border-ares-border bg-ares-card p-5">
            <h3 className="font-display text-[15px]">Invite email — template preview</h3>
            <div className="mt-4 overflow-hidden rounded-ares border border-ares-border">
              <div className="bg-ares-tertiary px-6 py-4">
                <span className="text-[13px] text-white">
                  AI Search <span className="text-[#83D6FA]">IQ</span>
                </span>
              </div>
              <div className="space-y-3 bg-white px-6 py-6">
                <p className="text-[16px] font-normal text-ares-text">Welcome to AI Search IQ</p>
                <p className="text-[12px] font-light leading-relaxed text-ares-secondarytext">
                  We're setting up <strong>&lt;Client name&gt;</strong> for AI search visibility
                  reporting. To get started, we need read-only access to your Google services —
                  granted by you through Google's official consent screen. We never ask for your
                  password.
                </p>
                <p className="text-[12px] font-light leading-relaxed text-ares-secondarytext">
                  Click below to connect <strong>Search Console</strong>, <strong>Google Analytics 4</strong>,
                  and <strong>Google Business Profile</strong>. It takes about two minutes.
                </p>
                <span className="inline-block rounded-ares bg-ares-primary px-5 py-2.5 text-[12px] text-white">
                  Connect your Google services
                </span>
                <p className="text-[10px] font-light text-ares-muted">
                  The link is unique per client and expires in 7 days.
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] font-light text-ares-muted">
              Report-ready emails use the same shell: client name, report type/period, headline
              score, and a portal button.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
