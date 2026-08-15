import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { icons } from '@/lib/icons';

/**
 * Global portal copilot (design.md §5.7): floating 48px primary button
 * bottom-right on every portal page; opens a 400px right drawer.
 * The drawer content here is a minimal stub — the Ask page agent owns
 * the full chat UI at /app/ask.
 */
export default function CopilotDrawer() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // The full copilot lives on /app/ask — no floating button there.
  if (location.pathname === '/app/ask') return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask AI Search IQ"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-ares bg-ares-primary text-white shadow-paper transition-colors duration-200 hover:bg-ares-primaryDark"
      >
        <Icon icon={icons.chatRoundDots} width={20} height={20} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-ares-tertiary/30"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-ares-border bg-ares-surface"
            >
              <div className="flex h-14 items-center justify-between border-b border-ares-border px-5">
                <div className="flex items-center gap-2.5">
                  <Icon icon={icons.chatRoundDots} width={18} height={18} className="text-ares-primary" />
                  <span className="font-display text-[15px]">Ask AI Search IQ</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close copilot"
                  className="flex h-8 w-8 items-center justify-center rounded-ares text-ares-muted transition-colors duration-200 hover:text-ares-primary"
                >
                  <Icon icon={icons.closeCircle} width={18} height={18} />
                </button>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <Icon icon={icons.chatRoundDots} width={36} height={36} className="text-ares-primary" />
                <p className="font-body text-ares-secondarytext">
                  Ask anything about your visibility data — every answer is cited to the scan
                  behind it.
                </p>
                <Link to="/app/ask" className="btn-primary" onClick={() => setOpen(false)}>
                  Open the full copilot
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
