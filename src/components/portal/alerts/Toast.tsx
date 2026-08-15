import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import { icons } from '@/lib/icons';

/**
 * Brand-styled transient toast (no global Toaster is mounted by the shell,
 * so portal pages host their own). Paper card, 3px primary left bar,
 * sits just above the floating copilot button.
 */
export function useToast(durationMs = 4200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { message, show };
}

export function ToastHost({ message }: { message: string | null }) {
  return (
    <div className="pointer-events-none fixed bottom-24 right-6 z-50 flex justify-end">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-ares border border-ares-border border-l-[3px] border-l-ares-primary bg-ares-card px-4 py-3 shadow-paper"
            role="status"
          >
            <Icon
              icon={icons.checkCircle}
              width={16}
              height={16}
              className="mt-0.5 shrink-0 text-ares-primary"
            />
            <p className="text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
              {message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
