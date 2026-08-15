import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { Reveal } from '@/components/portal/dashboard/shared';

/** S5 — full-width dark insight strip. */
export function InsightStrip() {
  return (
    <Reveal
      delay={0.25}
      className="flex flex-wrap items-center justify-between gap-4 rounded-ares bg-ares-tertiary p-6"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon icon={icons.infoCircle} width={18} height={18} className="mt-0.5 shrink-0 text-ares-primary" />
        <p className="text-[12px] font-light leading-[19.5px] text-on-dark">
          Northwind is strongest in local 'near me' and service-category prompts, and weakest in
          comparison and decision-stage prompts where Atlas Capital and Beacon Partners are
          consistently recommended.
        </p>
      </div>
      <Link to="/app/competitors" className="btn-secondary-dark shrink-0">
        See competitor gaps
      </Link>
    </Reveal>
  );
}
