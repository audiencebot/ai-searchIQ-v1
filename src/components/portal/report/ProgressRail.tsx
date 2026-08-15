import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { SHEETS } from './ReportStack';

/**
 * Reading-progress rail (report.md §S2): fixed 4px vertical track with a
 * primary fill tracking scroll progress through the sheet stack; section dots
 * jump-scroll to sheets on click. Hidden below xl and when printing.
 */
export default function ProgressRail() {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>(SHEETS[0].id);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(1, doc.scrollTop / max) : 0);

      let current: string = SHEETS[0].id;
      for (const sheet of SHEETS) {
        const el = document.getElementById(sheet.id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) {
          current = sheet.id;
        }
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="report-no-print fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 xl:block">
      <div className="relative flex flex-col items-center gap-3 py-2">
        {/* Track + fill */}
        <div className="absolute inset-y-2 left-1/2 w-[4px] -translate-x-1/2 rounded-ares bg-ares-border" />
        <div
          className="absolute left-1/2 top-2 w-[4px] -translate-x-1/2 rounded-ares bg-ares-primary transition-[height] duration-150"
          style={{ height: `calc(${(progress * 100).toFixed(1)}% - ${(progress * 16).toFixed(1)}px)` }}
        />
        {SHEETS.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            title={sheet.label}
            aria-label={`Jump to ${sheet.label}`}
            onClick={() =>
              document.getElementById(sheet.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className={cn(
              'relative z-10 h-2 w-2 rounded-full border transition-colors duration-200',
              activeId === sheet.id
                ? 'border-ares-primary bg-ares-primary'
                : 'border-ares-border bg-ares-card hover:border-ares-primary'
            )}
          />
        ))}
      </div>
    </div>
  );
}
