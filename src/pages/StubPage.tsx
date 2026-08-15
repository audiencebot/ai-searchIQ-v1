import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';

/** Simple centered placeholder for routes owned by later page agents. */
export default function StubPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center py-24 text-center">
      <Icon icon={icons.radar2} width={32} height={32} className="text-ares-primary" />
      <p className="font-label mt-6 text-ares-muted">AI Search IQ</p>
      <h1 className="font-display mt-3 text-[36px]">{title}.</h1>
      <div className="mt-6 h-px w-16 bg-ares-primary" />
      <p className="font-body mt-6 max-w-md text-ares-secondarytext">
        This page is under construction. The dossier is being typeset.
      </p>
    </div>
  );
}
