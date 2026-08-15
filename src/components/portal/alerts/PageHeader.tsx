import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * Portal page header (design.md §6 "scan line"): primary eyebrow,
 * 24px display headline, and a 1px primary rule that draws left → right.
 * `children` renders on the right (filter chips, progress pills, …).
 */
export default function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="font-label text-ares-primary">{eyebrow}</p>
          <h2 className="font-display mt-2 text-[24px]">{title}</h2>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      <motion.div
        className="mt-4 h-px w-full origin-left bg-ares-primary"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
