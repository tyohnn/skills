import { DOC_KINDS, docKindFromSlug, type DocKindName } from '../doc-kinds.ts';
import { classes } from '../lib/classes.ts';

export { DOC_KINDS, docKindFromSlug };
export type { DocKindName };

const KIND_STYLE: Record<DocKindName, string> = {
  PRD: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  US: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  PLAN: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
  SPEC: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  ADR: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export interface DocKindProps {
  kind: DocKindName;
  /** Short key shown in the badge, for example `PRD-001`. */
  ticker?: string;
  href?: string;
  className?: string;
}

export function DocKind({ kind, ticker, href, className }: DocKindProps) {
  const classNames = classes(
    'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide no-underline',
    ticker ? 'normal-case' : 'uppercase',
    KIND_STYLE[kind],
    href && 'hover:opacity-80',
    className,
  );
  const label = ticker ?? kind;

  return href ? (
    <a href={href} className={classNames}>
      {label}
    </a>
  ) : (
    <span className={classNames}>{label}</span>
  );
}
