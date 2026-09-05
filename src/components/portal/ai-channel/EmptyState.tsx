import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { Reveal } from '@/components/portal/dashboard/shared';
import type { IngestConnection } from './shared';

/**
 * Empty state (PRD §4.7 collection): no captured rows yet → guide the member
 * to connect a log drain with the ingest endpoint URL and the tenant's
 * masked ingest token.
 */
export function EmptyState({ connection }: { connection: IngestConnection | undefined }) {
  return (
    <Reveal delay={0.05} className="action-card p-8">
      <div className="mx-auto flex max-w-[560px] flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-ares bg-ares-primary/[0.08]">
          <Icon icon={icons.cloudUpload} width={24} height={24} className="text-ares-primary" />
        </span>
        <h3 className="font-display mt-4 text-[20px] text-ares-text">
          Connect a log drain to start measuring.
        </h3>
        <p className="mt-2 text-[12px] font-light leading-relaxed text-ares-muted">
          AI bots never execute JavaScript, so browser analytics are structurally blind to the
          AI channel. Forward your server logs from Vercel, Netlify, or Cloudflare — or batch
          upload — and AI Search IQ classifies every request into training crawls, citation
          fetches, and AI referrals. Measured, not estimated.
        </p>

        <div className="mt-6 w-full space-y-3 text-left">
          <div className="rounded-ares border border-ares-border bg-ares-pageBg p-4">
            <p className="font-label text-ares-muted">Ingest endpoint</p>
            <p className="mt-1.5 break-all font-mono text-[12px] text-ares-secondarytext">
              POST {connection?.ingestUrl ?? '/api/ingest/crawler-visit'}
            </p>
          </div>
          <div className="rounded-ares border border-ares-border bg-ares-pageBg p-4">
            <p className="font-label text-ares-muted">Tenant ingest token</p>
            <p className="mt-1.5 font-mono text-[12px] text-ares-secondarytext">
              {connection?.maskedToken ?? '••••————'}
              {connection?.tokenConfigured && (
                <span className="ml-2 text-ares-muted">(shown masked — full token in Settings)</span>
              )}
            </p>
          </div>
          <div className="rounded-ares border border-ares-border bg-ares-pageBg p-4">
            <p className="font-label text-ares-muted">Example batch payload</p>
            <pre className="mt-1.5 overflow-x-auto font-mono text-[11px] leading-relaxed text-ares-secondarytext">
{`{
  "tenantKey": "<your ingest token>",
  "visits": [
    { "ua": "…GPTBot/1.2…", "path": "/pricing",
      "status": 200, "ip": "20.171.207.14",
      "referer": null, "ts": 1767225600000 }
  ]
}`}
            </pre>
          </div>
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-[11px] font-light text-ares-muted">
          <Icon icon={icons.infoCircle} width={13} height={13} className="text-ares-primary" />
          Every request is verified against vendor-published bot IP ranges; unverifiable hits
          never reach headline metrics.
        </p>
      </div>
    </Reveal>
  );
}
