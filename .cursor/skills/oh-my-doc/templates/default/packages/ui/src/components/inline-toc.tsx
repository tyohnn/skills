import type { TOCItemType } from 'fumadocs-core/toc';
import { ChevronDown } from 'lucide-react';

export interface InlineTocProps {
  items: TOCItemType[];
  label?: string;
}

/** A native-details inline TOC that remains reliable in embedded browsers. */
export function InlineToc({ items, label = 'On this page' }: InlineTocProps) {
  if (items.length === 0) return null;

  return (
    <details className="not-prose group/toc mb-4 rounded-lg border bg-fd-card text-fd-card-foreground">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between px-4 py-2.5 font-medium [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-open/toc:rotate-180" />
      </summary>
      <div className="flex flex-col px-4 pb-4 text-sm text-fd-muted-foreground">
        {items.map((item) => (
          <a
            key={item.url}
            href={item.url}
            className="border-s py-1.5 hover:text-fd-accent-foreground"
            style={{ paddingInlineStart: 12 * Math.max(item.depth - 1, 0) }}
          >
            {item.title}
          </a>
        ))}
      </div>
    </details>
  );
}

/** Compatibility name for existing Fumadocs applications. */
export const DocsInlineToc = InlineToc;
