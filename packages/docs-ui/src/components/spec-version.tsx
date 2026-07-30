import { z } from 'zod';

export const specVersionSchema = z.object({
  spec: z.string().min(1),
  version: z.string().min(1),
  source: z.string().min(1),
  sourceHref: z.string().optional(),
  history: z
    .array(
      z.object({
        version: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        summary: z.string().min(1),
        ref: z.string().optional(),
        href: z.string().optional(),
      }),
    )
    .min(1),
});

export type SpecVersionProps = z.input<typeof specVersionSchema> & {
  /** Optional base URL used to turn repo-relative history refs into links. */
  sourceBaseUrl?: string;
};

export function SpecVersion({ sourceBaseUrl, ...input }: SpecVersionProps) {
  const { spec, version, source, sourceHref, history } = specVersionSchema.parse(input);

  return (
    <div className="not-prose bg-fd-card my-6 overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-baseline gap-2 border-b px-4 py-3">
        <span className="text-fd-muted-foreground text-xs uppercase tracking-wide">{spec}</span>
        <code className="bg-fd-primary/10 text-fd-primary rounded px-2 py-0.5 font-mono text-sm font-semibold">
          {version}
        </code>
        {sourceHref ? (
          <a
            className="text-fd-muted-foreground hover:text-fd-primary ml-auto font-mono text-xs"
            href={sourceHref}
          >
            {source}
          </a>
        ) : (
          <span className="text-fd-muted-foreground ml-auto font-mono text-xs">{source}</span>
        )}
      </div>
      <ol className="flex flex-col">
        {[...history].reverse().map((entry, index) => {
          const href =
            entry.href ??
            (entry.ref && sourceBaseUrl
              ? `${sourceBaseUrl.replace(/\/$/, '')}/${entry.ref.replace(/^\//, '')}`
              : undefined);
          return (
            <li key={`${entry.version}-${entry.date}`} className="flex gap-3 border-b px-4 py-2 last:border-0">
              <code
                className={`font-mono text-xs ${
                  index === 0 ? 'text-fd-primary font-semibold' : 'text-fd-muted-foreground'
                }`}
              >
                {entry.version}
              </code>
              <span className="text-fd-muted-foreground shrink-0 font-mono text-xs">
                {entry.date}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                {entry.summary}
                {href ? (
                  <a
                    className="text-fd-muted-foreground hover:text-fd-primary ml-2 font-mono text-xs underline underline-offset-2"
                    href={href}
                  >
                    {entry.ref ?? 'source'}
                  </a>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
