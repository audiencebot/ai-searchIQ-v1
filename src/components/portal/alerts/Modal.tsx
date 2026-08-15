import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import { icons } from '@/lib/icons';

/**
 * Brand modal (settings.md §S2: fade + scale 0.96 → 1, 200ms).
 * Paper surface, 1px border, 2px radius.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-ares-tertiary/40"
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto w-full max-w-md rounded-ares border border-ares-border bg-ares-surface shadow-paper"
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <div className="flex items-center justify-between border-b border-ares-border px-5 py-4">
                <h3 className="font-display text-[15px]">{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="flex h-8 w-8 items-center justify-center rounded-ares text-ares-muted transition-colors duration-200 hover:text-ares-primary"
                >
                  <Icon icon={icons.closeCircle} width={18} height={18} />
                </button>
              </div>
              <div className="px-5 py-4">{children}</div>
              {footer && (
                <div className="flex items-center justify-end gap-2 border-t border-ares-border px-5 py-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
