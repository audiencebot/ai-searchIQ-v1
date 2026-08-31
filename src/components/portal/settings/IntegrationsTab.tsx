import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/react';
import { motion } from 'framer-motion';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../api/router';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import Modal from '@/components/portal/alerts/Modal';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Integration = RouterOutputs['settings']['integrations'][number];
type Provider = Integration['provider'];
type GoogleIntegration = Extract<Integration, { google: unknown }>;
type GoogleInfo = GoogleIntegration['google'];
type GoogleService = GoogleIntegration['provider'];

const PROVIDER_ICON: Record<Provider, IconifyIcon> = {
  gbp: icons.mapPoint,
  gsc: icons.graphUp,
  ga4: icons.chart2,
  dataforseo: icons.globalLinear,
  lighthouse: icons.shieldCheck,
};

const GOOGLE_RESOURCE_HINT: Record<GoogleService, { label: string; placeholder: string }> = {
  gsc: {
    label: 'Search Console property',
    placeholder: 'https://example.com/ or sc-domain:example.com',
  },
  ga4: {
    label: 'GA4 property ID',
    placeholder: '123456789',
  },
  gbp: {
    label: 'Business Profile location',
    placeholder: 'accounts/123/locations/456',
  },
};

/** GBP stores {account, location} JSON — derive the location for display/input. */
function googleResourceLabel(service: GoogleService, externalAccountId: string): string {
  if (service === 'gbp') {
    try {
      const parsed = JSON.parse(externalAccountId) as { location?: string };
      if (parsed.location) return parsed.location;
    } catch {
      // fall through — show the raw value
    }
  }
  return externalAccountId;
}

/** Normalize user input into the stored externalAccountId form. */
function googleResourceValue(service: GoogleService, raw: string): string {
  const value = raw.trim();
  if (service === 'gbp' && !value.startsWith('{')) {
    // Bare location resource name — account is the path before /locations/.
    const [account] = value.split('/locations/');
    return JSON.stringify({ account: account ?? value, location: value });
  }
  return value;
}

/** Google service card (GSC / GA4 / GBP) — real per-tenant OAuth connect flow. */
function GoogleServiceCard({
  integration,
  notify,
}: {
  integration: GoogleIntegration;
  notify: (msg: string) => void;
}) {
  const google: GoogleInfo = integration.google;
  const utils = trpc.useUtils();
  const [resourceInput, setResourceInput] = useState('');

  const authUrl = trpc.settings.googleAuthUrl.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => notify(err.message || 'Could not start the Google OAuth flow.'),
  });
  const disconnect = trpc.settings.disconnectGoogle.useMutation({
    onSuccess: () => {
      utils.settings.integrations.invalidate();
      notify(`${integration.name} disconnected — scores will rely on remaining sources.`);
    },
    onError: (err) => notify(err.message || 'Could not disconnect the integration.'),
  });
  const setResource = trpc.settings.setGoogleResource.useMutation({
    onSuccess: (res) => {
      if (res.connected) {
        utils.settings.integrations.invalidate();
        setResourceInput('');
        notify(`${integration.name} resource saved — sync will use it from now on.`);
      } else {
        notify(`Reconnect ${integration.name} before picking a resource.`);
      }
    },
    onError: (err) => notify(err.message || 'Could not save the resource.'),
  });

  const hint = GOOGLE_RESOURCE_HINT[integration.provider];
  const resourceLabel = google.externalAccountId
    ? googleResourceLabel(integration.provider, google.externalAccountId)
    : null;

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ares border border-ares-border bg-ares-surface">
          <Icon
            icon={PROVIDER_ICON[integration.provider]}
            width={20}
            height={20}
            className="text-ares-primary"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-normal text-ares-text">{integration.name}</p>
          <p className="mt-0.5 text-[11px] font-light leading-[16px] text-ares-muted">
            {integration.role}
          </p>
        </div>
        {!google.configured && <span className="badge-pill text-ares-muted">Not configured</span>}
        {google.configured && !google.connected && (
          <button
            className="btn-primary !px-3 !py-1.5 text-[10px]"
            disabled={authUrl.isPending}
            onClick={() => authUrl.mutate({ service: integration.provider })}
          >
            {authUrl.isPending ? 'Redirecting…' : 'Connect to Google'}
          </button>
        )}
        {google.connected && (
          <span className="badge-pill border-ares-primary/40 text-ares-primary">
            <Icon icon={icons.checkCircle} width={12} height={12} />
            Connected
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ares-border2 pt-3">
        {!google.configured && (
          <span className="text-[10px] font-light text-ares-muted">
            OAuth client not configured — your platform admin must set the Google client env vars.
          </span>
        )}
        {google.configured && !google.connected && (
          <span className="text-[10px] font-light text-ares-muted">
            OAuth 2.0 · read-only scope · you can disconnect at any time
          </span>
        )}
        {google.connected && (
          <>
            <span className="text-[10px] font-light text-ares-muted">
              {google.accountLabel ?? 'Google account authorized'}
              {resourceLabel ? ` · ${resourceLabel}` : ''}
            </span>
            <span className="ml-auto flex gap-3">
              <button
                className="text-[10px] font-light uppercase tracking-[0.08em] text-ares-link transition-colors duration-200 hover:text-ares-primaryDark"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate({ service: integration.provider })}
              >
                {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </span>
          </>
        )}
      </div>

      {google.connected && google.needsResource && (
        <div className="mt-3">
          <p className="text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
            {hint.label}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              value={resourceInput}
              onChange={(e) => setResourceInput(e.target.value)}
              placeholder={hint.placeholder}
              className="w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-secondarytext placeholder:text-ares-muted focus:border-ares-primaryDark focus:outline-none"
            />
            <button
              className="btn-primary !px-3 !py-1.5 text-[10px]"
              disabled={!resourceInput.trim() || setResource.isPending}
              onClick={() =>
                setResource.mutate({
                  service: integration.provider,
                  externalAccountId: googleResourceValue(integration.provider, resourceInput),
                })
              }
            >
              {setResource.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Standard integration card (Lighthouse — platform-managed). */
function GenericCard({
  integration,
  pending,
  onConnect,
  onReconnect,
  onDisconnect,
}: {
  integration: Integration;
  pending: boolean;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ares border border-ares-border bg-ares-surface">
          <Icon
            icon={PROVIDER_ICON[integration.provider]}
            width={20}
            height={20}
            className="text-ares-primary"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-normal text-ares-text">{integration.name}</p>
          <p className="mt-0.5 text-[11px] font-light leading-[16px] text-ares-muted">
            {integration.role}
          </p>
        </div>
        {integration.status === 'connected' && (
          <span className="badge-pill border-ares-primary/40 text-ares-primary">
            <Icon icon={icons.checkCircle} width={12} height={12} />
            Connected
          </span>
        )}
        {integration.status === 'platform_managed' && (
          <span className="badge-pill text-ares-muted">Platform-managed</span>
        )}
        {integration.status === 'not_connected' && (
          <button className="btn-primary !px-3 !py-1.5 text-[10px]" onClick={onConnect}>
            Connect
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ares-border2 pt-3">
        {integration.status === 'connected' && (
          <>
            <span className="text-[10px] font-light text-ares-muted">
              {integration.meta?.syncNote ?? 'Sync active'}
            </span>
            <span className="ml-auto flex gap-3">
              <button
                className="text-[10px] font-light uppercase tracking-[0.08em] text-ares-link transition-colors duration-200 hover:text-ares-primary"
                disabled={pending}
                onClick={onReconnect}
              >
                Reconnect
              </button>
              <button
                className="text-[10px] font-light uppercase tracking-[0.08em] text-ares-link transition-colors duration-200 hover:text-ares-primaryDark"
                disabled={pending}
                onClick={onDisconnect}
              >
                Disconnect
              </button>
            </span>
          </>
        )}
        {integration.status === 'not_connected' && (
          <span className="text-[10px] font-light text-ares-muted">
            {integration.meta?.note ?? 'OAuth 2.0 · read-only scope'}
          </span>
        )}
        {integration.status === 'platform_managed' && (
          <span className="text-[10px] font-light text-ares-muted">
            {integration.meta?.note ??
              'Included in your plan — no credential needed · refreshes weekly'}
          </span>
        )}
      </div>
    </>
  );
}

/** DataForSEO card — real platform-credentials status + live connectivity test. */
function DataForSeoCard({
  integration,
  notify,
}: {
  integration: Integration;
  notify: (msg: string) => void;
}) {
  const test = trpc.settings.testDataForSeoConnection.useMutation({
    onSuccess: (res) => {
      if (res.ok) notify(`DataForSEO connected — balance $${res.balance.toFixed(2)}.`);
    },
    onError: (err) => notify(err.message || 'DataForSEO connection test failed.'),
  });
  const result = test.data;

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ares border border-ares-border bg-ares-surface">
          <Icon
            icon={PROVIDER_ICON[integration.provider]}
            width={20}
            height={20}
            className="text-ares-primary"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-normal text-ares-text">{integration.name}</p>
          <p className="mt-0.5 text-[11px] font-light leading-[16px] text-ares-muted">
            {integration.role}
          </p>
        </div>
        {integration.status === 'connected' ? (
          <span className="badge-pill border-ares-primary/40 text-ares-primary">
            <Icon icon={icons.checkCircle} width={12} height={12} />
            Connected
          </span>
        ) : (
          <span className="badge-pill text-ares-muted">Not configured</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ares-border2 pt-3">
        <span className="text-[10px] font-light text-ares-muted">
          {integration.meta?.syncNote ?? 'Platform-managed credentials'}
        </span>
        <span className="ml-auto">
          <button
            className="text-[10px] font-light uppercase tracking-[0.08em] text-ares-link transition-colors duration-200 hover:text-ares-primary"
            disabled={test.isPending}
            onClick={() => test.mutate()}
          >
            {test.isPending ? 'Testing…' : 'Test connection'}
          </button>
        </span>
      </div>

      {result?.ok && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-light text-ares-primary">
          <Icon icon={icons.checkCircle} width={12} height={12} />
          Connected as {result.login} · balance ${result.balance.toFixed(2)}
        </p>
      )}
      {(result && !result.ok) || test.isError ? (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-light text-ares-primaryDark">
          <Icon icon={icons.dangerTriangle} width={12} height={12} />
          {(result && !result.ok && result.error) || test.error?.message || 'Connection failed'}
        </p>
      ) : null}
    </>
  );
}

export default function IntegrationsTab({ notify }: { notify: (msg: string) => void }) {
  const [connecting, setConnecting] = useState<Integration | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const utils = trpc.useUtils();
  const integrations = trpc.settings.integrations.useQuery();
  const setStatus = trpc.settings.setIntegrationStatus.useMutation({
    onSuccess: (_row, vars) => {
      utils.settings.integrations.invalidate();
      if (vars.status === 'connected' && connecting) {
        notify(`${connecting.name} connected — first sync scheduled.`);
        setConnecting(null);
      }
    },
    onError: (err) => notify(err.message || 'Could not update the integration.'),
  });

  // OAuth return flash: /app/settings?tab=integrations&connected=<service>.
  const connectedFlash = searchParams.get('connected');
  const googleError = searchParams.get('googleError');
  useEffect(() => {
    if (!connectedFlash && !googleError) return;
    if (connectedFlash) {
      const names: Record<string, string> = {
        gsc: 'Google Search Console',
        ga4: 'Google Analytics 4',
        gbp: 'Google Business Profile',
      };
      notify(`${names[connectedFlash] ?? 'Google'} connected — first sync scheduled.`);
      utils.settings.integrations.invalidate();
    } else if (googleError === 'access_denied') {
      notify('Google authorization was cancelled — nothing was connected.');
    } else {
      notify('Google connection failed — please try again.');
    }
    const next = new URLSearchParams(searchParams);
    next.delete('connected');
    next.delete('googleError');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedFlash, googleError]);

  const connect = (provider: Provider) =>
    setStatus.mutate({ provider, status: 'connected' });

  return (
    <div>
      <p className="max-w-[560px] text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
        These connections ground your scores in reality — GBP is the ground truth for
        misrepresentation alerts, GSC grounds your prompt set, GA4 proves visibility turns into
        visits.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {integrations.isLoading && (
          <>
            <LoadingBlock rows={3} />
            <LoadingBlock rows={3} />
          </>
        )}
        {integrations.isError && (
          <div className="md:col-span-2">
            <ErrorBlock
              message={integrations.error.message}
              onRetry={() => integrations.refetch()}
            />
          </div>
        )}
        {integrations.isSuccess &&
          integrations.data.map((integration, i) => (
            <motion.div
              key={integration.provider}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="action-card p-5"
            >
              {integration.provider === 'dataforseo' ? (
                <DataForSeoCard integration={integration} notify={notify} />
              ) : 'google' in integration ? (
                <GoogleServiceCard integration={integration} notify={notify} />
              ) : (
                <GenericCard
                  integration={integration}
                  pending={setStatus.isPending}
                  onConnect={() => setConnecting(integration)}
                  onReconnect={() => {
                    notify(`${integration.name} reconnected — sync scheduled.`);
                    connect(integration.provider);
                  }}
                  onDisconnect={() => {
                    setStatus.mutate({
                      provider: integration.provider,
                      status: 'not_connected',
                    });
                    notify(
                      `${integration.name} disconnected — scores will rely on remaining sources.`
                    );
                  }}
                />
              )}
            </motion.div>
          ))}

        {/* Sixth card — AI Search data collection (informational, dark) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-ares bg-ares-tertiary p-5 md:col-span-2"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ares border border-white/20">
              <Icon icon={icons.radar2} width={20} height={20} className="text-ares-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-normal text-white">AI Search data collection</p>
              <p className="mt-0.5 text-[11px] font-light leading-[16px] text-on-dark-muted">
                First-party prompt execution across six engines
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-light uppercase tracking-[0.08em] text-on-dark">
              <Icon icon={icons.checkCircle} width={13} height={13} className="text-ares-primary" />
              Active — daily 06:00 UTC · last scan complete (72/72 executions)
            </span>
          </div>
        </motion.div>
      </div>

      {/* OAuth stub modal (Lighthouse) */}
      <Modal
        open={connecting !== null}
        onClose={() => setConnecting(null)}
        title={connecting ? `Connect ${connecting.name}` : 'Connect'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConnecting(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={setStatus.isPending}
              onClick={() => connecting && connect(connecting.provider)}
            >
              Continue with Google
            </button>
          </>
        }
      >
        <p className="text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
          You'll be redirected to Google to authorize read-only access. AI Search IQ never writes
          to your account — {connecting?.name ?? 'this connection'} is used only to ground your
          visibility data.
        </p>
        <p className="mt-3 text-[10px] font-light text-ares-muted">
          {connecting?.meta?.note ?? 'OAuth 2.0 · read-only scope'} · you can disconnect at any
          time.
        </p>
      </Modal>
    </div>
  );
}
