import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';

const INPUT_CLASS =
  'w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-secondarytext placeholder:text-ares-muted focus:border-ares-primary focus:outline-none';

const PRICING_OPTIONS = ['Not published', 'Published on website', 'Available on request'];

function Field({
  label,
  hint,
  index,
  children,
}: {
  label: string;
  hint?: ReactNode;
  index: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <label className="font-label text-ares-muted">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[10px] font-light text-ares-muted">{hint}</p>}
    </motion.div>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  return (
    <div className="rounded-ares border border-ares-border bg-ares-card px-2 py-2 focus-within:border-ares-primary">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <motion.span
            key={tag}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="badge-pill text-ares-secondarytext"
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
              className="text-ares-muted transition-colors duration-150 hover:text-ares-primaryDark"
            >
              <Icon icon={icons.closeCircle} width={11} height={11} />
            </button>
          </motion.span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-[12px] font-light text-ares-secondarytext placeholder:text-ares-muted focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function BusinessProfileTab({ notify }: { notify: (msg: string) => void }) {
  const utils = trpc.useUtils();
  const profileQuery = trpc.settings.profile.useQuery();

  const [legalName, setLegalName] = useState('');
  const [founded, setFounded] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [website, setWebsite] = useState('');
  const [pricing, setPricing] = useState('Not published');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const data = profileQuery.data;
    if (data && !hydrated) {
      setLegalName(data.profile?.legalName ?? data.name);
      setFounded(String(data.profile?.founded ?? ''));
      setRegions(data.profile?.serviceRegions ?? []);
      setServices(data.profile?.services ?? []);
      setWebsite(data.websiteUrl);
      setPricing(data.profile?.pricingVisibility ?? 'Not published');
      setHydrated(true);
    }
  }, [profileQuery.data, hydrated]);

  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      utils.settings.profile.invalidate();
      notify('Ground truth updated — alerts will re-verify on the next scan.');
    },
    onError: (err) => notify(err.message || 'Could not save the business profile.'),
  });

  if (profileQuery.isLoading) return <LoadingBlock rows={6} className="max-w-[640px] rounded-ares border border-ares-border bg-ares-card p-6" />;
  if (profileQuery.isError)
    return (
      <div className="max-w-[640px]">
        <ErrorBlock message={profileQuery.error.message} onRetry={() => profileQuery.refetch()} />
      </div>
    );

  const save = () => {
    const foundedYear = parseInt(founded, 10);
    if (!legalName.trim() || !Number.isFinite(foundedYear)) {
      notify('Legal name and a valid founding year are required.');
      return;
    }
    updateProfile.mutate({
      websiteUrl: website.trim() || undefined,
      profile: {
        legalName: legalName.trim(),
        founded: foundedYear,
        serviceRegions: regions,
        services,
        pricingVisibility: pricing,
      },
    });
  };

  return (
    <div className="max-w-[640px] rounded-ares border border-ares-border bg-ares-card p-6">
      <p className="font-label text-ares-primary">Ground truth record</p>
      <p className="mt-2 text-[11px] font-light leading-[17px] text-ares-muted">
        This is the record misrepresentation alerts validate AI answers against. Keep it exact.
      </p>

      <div className="mt-5 space-y-4">
        <Field label="Legal name" index={0}>
          <input
            className={INPUT_CLASS}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
        </Field>
        <Field label="Founded" index={1}>
          <input
            className={INPUT_CLASS}
            type="number"
            min={1800}
            max={2100}
            value={founded}
            onChange={(e) => setFounded(e.target.value)}
          />
        </Field>
        <Field label="Service regions" index={2}>
          <TagInput tags={regions} onChange={setRegions} placeholder="Add a region…" />
        </Field>
        <Field label="Services" index={3}>
          <TagInput tags={services} onChange={setServices} placeholder="Add a service…" />
        </Field>
        <Field label="Website" index={4}>
          <input
            className={INPUT_CLASS}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>
        <Field
          label="Pricing visibility"
          index={5}
          hint={
            <>
              Publishing pricing resolves Alert 03.{' '}
              <Link to="/app/alerts" className="text-ares-link hover:text-ares-primary">
                View alert
              </Link>
            </>
          }
        >
          <select
            className={INPUT_CLASS}
            value={pricing}
            onChange={(e) => setPricing(e.target.value)}
          >
            {PRICING_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-6 flex justify-end border-t border-ares-border2 pt-4">
        <button className="btn-primary" onClick={save} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
