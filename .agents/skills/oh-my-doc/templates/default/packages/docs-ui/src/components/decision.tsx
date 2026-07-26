import type { ReactNode } from 'react';
import { z } from 'zod';

export const decisionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['accepted', 'superseded', 'locked']).default('accepted'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rejected: z
    .array(z.object({ option: z.string().min(1), because: z.string().min(1) }))
    .min(1, { message: 'a decision must record at least one rejected alternative' }),
  commit: z.string().optional(),
});

export type DecisionProps = z.input<typeof decisionSchema> & { children?: ReactNode };

const STATUS_STYLE = {
  accepted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  superseded: 'bg-fd-muted text-fd-muted-foreground line-through',
  locked: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
} as const;

export function Decision({ children, ...input }: DecisionProps) {
  const { id, title, status, date, rejected, commit } = decisionSchema.parse(input);

  return (
    <div id={id} className="not-prose bg-fd-card my-6 rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="text-fd-muted-foreground font-mono text-xs">{id}</span>
        <h4 className="flex-1 font-semibold">{title}</h4>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
          {status}
        </span>
        <span className="text-fd-muted-foreground font-mono text-xs">{date}</span>
      </div>
      {children ? (
        <div className="prose-sm px-4 py-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {children}
        </div>
      ) : null}
      <div className="border-t px-4 py-3">
        <h5 className="text-fd-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
          Rejected alternatives
        </h5>
        <ul className="flex flex-col gap-2">
          {rejected.map((alternative) => (
            <li key={alternative.option} className="text-sm">
              <span className="text-fd-foreground font-medium line-through decoration-fd-muted-foreground/50">
                {alternative.option}
              </span>
              <span className="text-fd-muted-foreground"> — {alternative.because}</span>
            </li>
          ))}
        </ul>
        {commit ? (
          <p className="text-fd-muted-foreground mt-3 font-mono text-xs">
            landed in <code>{commit}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
