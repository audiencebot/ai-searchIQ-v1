import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

const SERVICES: { key: 'gsc' | 'ga4' | 'gbp'; name: string; blurb: string; icon: IconifyIcon }[] = [
  {
    key: 'gsc',
    name: 'Search Console',
    blurb: 'Query demand and search performance for your site (read-only).',
    icon: icons.graphUp,
  },
  {
    key: 'ga4',
    name: 'Google Analytics 4',
    blurb: 'AI-referral attribution: how visibility turns into visits (read-only).',
    icon: icons.chart2,
  },
  {
    key: 'gbp',
    name: 'Business Profile',
    blurb: 'Listing, categories, and service areas — your ground truth.',
    icon: icons.mapPoint,
  },
];

function StatePage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-ares-pageBg px-4">
      <div className="w-full max-w-md rounded-ares border border-ares-border bg-ares-card p-8 text-center">
        <Icon icon={icons.infoCircle} width={28} height={28} className="mx-auto text-ares-primary" />
        <h1 className="font-display mt-4 text-[20px]">{title}</h1>
        <p className="mt-2 text-[12px] font-light leading-relaxed text-ares-muted">{body}</p>
      </div>
    </div>
  );
}

/**
 * Public client-connect page (plan §4 step 4): no login — the invite token in
 * the URL is the credential. Starts the existing per-tenant Google OAuth flow
 * with the token riding in the signed state; the callback returns here.
 */
export default function Connect() {
  const { inviteToken = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = trpc.connect.session.useQuery(
    { token: inviteToken },
    { enabled: Boolean(inviteToken), retry: false }
  );
  const startOAuth = trpc.connect.googleAuthUrl.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  // Clear the ?connected= / ?googleError= flash params after reading them.
  const connected = searchParams.get('connected');
  const googleError = searchParams.get('googleError');
  useEffect(() => {
    if (connected || googleError) {
      setSearchParams({}, { replace: true });
      session.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, googleError]);

  if (!inviteToken || (session.data && session.data.state === 'unknown')) {
    return (
      <StatePage
        title="This link doesn't check out"
        body="The onboarding link is unknown or malformed. Ask your AI Search IQ contact to send a fresh invite."
      />
    );
  }
  if (session.data?.state === 'expired') {
    return (
      <StatePage
        title="This link has expired"
        body="Onboarding links are valid for 7 days. Ask AI Search IQ to re-send your invite and you'll get a fresh one."
      />
    );
  }
  if (session.data?.state === 'done') {
    return (
      <StatePage
        title="You're all set"
        body="Onboarding is complete — AI Search IQ will email your reports as they're ready."
      />
    );
  }

  const services = session.data?.state === 'ok' ? session.data.services : null;
  const connectedCount = services?.filter((s) => s.connected).length ?? 0;
  const allConnected = services ? connectedCount === SERVICES.length : false;

  return (
    <div className="min-h-[100dvh] bg-ares-pageBg">
      <header className="border-b border-ares-border bg-ares-tertiary">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Icon icon={icons.radar2} width={20} height={20} className="text-ares-primary" />
          <span className="ml-2.5 text-[13px] font-light tracking-[0.02em] text-white">AI Search IQ</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="font-label text-ares-primary">Onboarding</p>
        <h1 className="font-display mt-2 text-[26px] leading-tight">
          Connect your Google services
          {session.data?.state === 'ok' ? ` for ${session.data.clientName}` : ''}
        </h1>
        <p className="mt-3 max-w-lg text-[13px] font-light leading-relaxed text-ares-secondarytext">
          AI Search IQ reads your search and analytics data to measure AI visibility. Access is
          granted by you through Google's official consent screen — read-only, revocable any time.
          We never ask for your password.
        </p>

        {googleError && (
          <p className="mt-4 rounded-ares border border-ares-border bg-ares-secondary/40 px-4 py-3 text-[12px] font-light text-ares-ink">
            Google didn't complete the connection ({googleError}). You can try again below.
          </p>
        )}

        <div className="mt-8 space-y-3">
          {SERVICES.map((svc) => {
            const isConnected = services?.find((s) => s.service === svc.key)?.connected ?? false;
            return (
              <div
                key={svc.key}
                className={cn(
                  'flex items-center gap-4 rounded-ares border bg-ares-card p-5',
                  isConnected ? 'border-ares-primary/50' : 'border-ares-border'
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ares bg-ares-secondary/50">
                  <Icon icon={svc.icon} width={20} height={20} className="text-ares-primaryDark" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-normal text-ares-text">{svc.name}</p>
                  <p className="mt-0.5 text-[11px] font-light text-ares-muted">{svc.blurb}</p>
                </div>
                {isConnected ? (
                  <span className="flex items-center gap-1.5 text-[12px] font-normal text-ares-primaryDark">
                    <Icon icon={icons.checkCircle} width={18} height={18} className="text-ares-primary" />
                    Connected
                  </span>
                ) : (
                  <button
                    className="btn-primary px-4 py-2 text-[11px]"
                    disabled={startOAuth.isPending || !services}
                    onClick={() => startOAuth.mutate({ token: inviteToken, service: svc.key })}
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {startOAuth.error && (
          <p className="mt-4 rounded-ares border border-ares-border bg-ares-secondary/40 px-4 py-3 text-[12px] font-light text-ares-ink">
            {startOAuth.error.message}
          </p>
        )}

        <div className="mt-8 rounded-ares border border-ares-border bg-ares-card p-5">
          {allConnected ? (
            <p className="flex items-start gap-2.5 text-[12px] font-light leading-relaxed text-ares-secondarytext">
              <Icon icon={icons.checkCircle} width={16} height={16} className="mt-0.5 shrink-0 text-ares-primary" />
              You're all set — AI Search IQ will email your first report as soon as it's ready.
            </p>
          ) : (
            <p className="text-[12px] font-light leading-relaxed text-ares-secondarytext">
              {connectedCount}/3 connected. Connect what you can now — anything you skip can be
              added later. When you're done, you're all set: AI Search IQ will email your first
              report as soon as it's ready.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
