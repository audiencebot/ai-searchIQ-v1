import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ErrorCard, Reveal, Skeleton, EASE_OUT, type RouterOutputs } from './shared';

type EngineData = RouterOutputs['dashboard']['scoreByEngine'] | undefined;
type ComponentsData = RouterOutputs['dashboard']['components'] | undefined;

/** S3 left — six animated bar rows, canonical engine order. */
export function ScoreByEngine({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data: EngineData;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <Reveal className="action-card p-6">
      <p className="font-label text-ares-primary">Score by engine</p>
      {isLoading && (
        <div className="mt-5 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-[140px]" />
              <Skeleton className="h-1.5 flex-1" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      )}
      {isError && (
        <ErrorCard className="mt-5 border-0 p-6" message="Engine scores unavailable." onRetry={onRetry} />
      )}
      {data && (
        <>
          <div className="mt-5 space-y-3.5">
            {data.rows.map((row, i) => (
              <Link
                key={row.engine}
                to={`/app/monitoring?engine=${row.engine}`}
                title={`Composite for ${row.label}, weighted per methodology v1.2`}
                className="group flex items-center gap-3"
              >
                <span className="w-[140px] shrink-0 truncate text-[11px] font-light text-ares-secondarytext transition-colors duration-200 group-hover:text-ares-primary">
                  {row.label}
                </span>
                <span className="bar-track flex-1">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${row.score}%` }}
                    transition={{ duration: 0.9, delay: i * 0.08, ease: EASE_OUT }}
                    className="bar-fill block"
                  />
                </span>
                <span className="w-7 shrink-0 text-right text-[11px] font-normal text-ares-primary">
                  {row.score}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-5 text-[10px] font-light text-ares-muted">
            {data.spread}-point spread between strongest and weakest engine — the average hides
            this.
          </p>
        </>
      )}
    </Reveal>
  );
}

/** S3 right — component / weight / score / contribution table (verbatim). */
export function ScoreComponents({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data: ComponentsData;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <Reveal delay={0.1} className="action-card p-6">
      <p className="font-label text-ares-primary">Score components</p>
      {isLoading && (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}
      {isError && (
        <ErrorCard className="mt-5 border-0 p-6" message="Score components unavailable." onRetry={onRetry} />
      )}
      {data && (
        <>
          <table className="data-table mt-4">
            <thead>
              <tr>
                <th>Component</th>
                <th className="text-right">Weight</th>
                <th className="text-right">Score</th>
                <th className="text-right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <motion.tr
                  key={row.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                >
                  <td className="text-ares-text">{row.component}</td>
                  <td className="text-right text-ares-muted">{row.weight}%</td>
                  <td className="text-right font-normal text-ares-primary">{row.score}</td>
                  <td className="text-right text-ares-secondarytext">{row.contribution}</td>
                </motion.tr>
              ))}
              <tr className="bg-ares-primary/[0.04]">
                <td className="font-normal text-ares-primary">Composite</td>
                <td className="text-right font-normal text-ares-primary">{data.composite.weight}%</td>
                <td className="text-right font-normal text-ares-primary">{data.composite.raw}</td>
                <td className="text-right font-normal text-ares-primary">
                  {data.composite.indexed} indexed
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-[10px] font-light text-ares-muted">{data.methodology}</p>
        </>
      )}
    </Reveal>
  );
}
