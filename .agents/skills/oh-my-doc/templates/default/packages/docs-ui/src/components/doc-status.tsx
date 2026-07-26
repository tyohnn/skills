import { classes } from '../lib/classes.ts';

export const DOC_STATUSES = ['draft', 'accepted', 'ready', 'active', 'done', 'superseded'] as const;
export type DocStatusName = (typeof DOC_STATUSES)[number];

const STATUS_STYLE: Record<DocStatusName, string> = {
  draft: 'bg-fd-muted text-fd-muted-foreground',
  accepted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  ready: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  active: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  superseded: 'bg-fd-muted text-fd-muted-foreground line-through',
};

export interface DocStatusProps {
  status: DocStatusName;
  className?: string;
}

export function DocStatus({ status, className }: DocStatusProps) {
  return (
    <span
      className={classes(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide normal-case',
        STATUS_STYLE[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

export const ADR_STATUSES = ['accepted', 'locked', 'superseded'] as const;
export type AdrStatusName = (typeof ADR_STATUSES)[number];

export interface AdrStatusProps {
  status: AdrStatusName;
  className?: string;
}

const ADR_STATUS_STYLE: Record<AdrStatusName, string> = {
  accepted: STATUS_STYLE.accepted,
  locked: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  superseded: STATUS_STYLE.superseded,
};

export function AdrStatus({ status, className }: AdrStatusProps) {
  return (
    <span
      className={classes(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide normal-case',
        ADR_STATUS_STYLE[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
