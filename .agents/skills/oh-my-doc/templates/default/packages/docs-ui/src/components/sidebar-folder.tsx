'use client';

import type * as PageTree from 'fumadocs-core/page-tree';
import { usePathname } from 'fumadocs-core/framework';
import Link from 'fumadocs-core/link';
import { SidebarFolder, useFolderDepth } from 'fumadocs-ui/components/sidebar/base';
import { useTreePath } from 'fumadocs-ui/contexts/tree';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { classes } from '../lib/classes.ts';

const STORAGE_KEY = 'oh-my-docs.sidebar-folders';
const itemClass =
  'relative flex w-full flex-row items-center gap-1 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary [&_svg]:size-4 [&_svg]:shrink-0';

type FolderOpenMap = Record<string, boolean>;

function normalize(url: string) {
  return url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;
}

function isActiveOrUnder(href: string, pathname: string) {
  const normalizedHref = normalize(href);
  const normalizedPath = normalize(pathname);
  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

function folderContainsPath(item: PageTree.Folder, pathname: string): boolean {
  if (item.index?.url && isActiveOrUnder(item.index.url, pathname)) return true;
  return item.children.some((child) => {
    if (child.type === 'folder') return folderContainsPath(child, pathname);
    return child.type === 'page' && isActiveOrUnder(child.url, pathname);
  });
}

function folderLabel(name: ReactNode) {
  return typeof name === 'string' || typeof name === 'number' ? String(name) : 'Section';
}

function folderStorageKey(item: PageTree.Folder) {
  return item.$id ?? item.index?.url ?? `name:${folderLabel(item.name)}`;
}

function readOpenMap(): FolderOpenMap {
  if (typeof window === 'undefined') return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as FolderOpenMap) : {};
  } catch {
    return {};
  }
}

function writeOpenState(key: string, open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readOpenMap(), [key]: open }));
  } catch {
    // Storage can be unavailable in private or embedded browsing contexts.
  }
}

function itemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

function FolderContent({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();
  return (
    <div
      className={classes(
        'relative flex flex-col gap-0.5 pt-0.5',
        depth === 1 &&
          "before:absolute before:inset-y-1 before:inset-s-2.5 before:w-px before:bg-fd-border before:content-['']",
      )}
    >
      {children}
    </div>
  );
}

function IndexLink({
  item,
  active,
  label,
}: {
  item: PageTree.Folder;
  active: boolean;
  label: string;
}) {
  const depth = useFolderDepth();
  if (!item.index) return null;
  return (
    <Link
      href={item.index.url}
      {...(typeof item.index.external === 'boolean' ? { external: item.index.external } : {})}
      className={classes(itemClass, active && 'bg-fd-primary/10 text-fd-primary')}
      style={{ paddingInlineStart: itemOffset(depth - 1) }}
      data-active={active}
      title={label}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {item.icon}
        {item.name}
      </span>
    </Link>
  );
}

function PersistentDetails({
  item,
  inPath,
  children,
}: {
  item: PageTree.Folder;
  inPath: boolean;
  children: ReactNode;
}) {
  const depth = useFolderDepth();
  const key = folderStorageKey(item);
  const label = folderLabel(item.name);
  const wasInPath = useRef(inPath);
  const [open, setOpen] = useState(() => inPath || Boolean(item.defaultOpen));

  useEffect(() => {
    const stored = readOpenMap()[key];
    if (typeof stored === 'boolean') setOpen(stored);
  }, [key]);

  useEffect(() => {
    if (inPath && !wasInPath.current) {
      setOpen(true);
      writeOpenState(key, true);
    }
    wasInPath.current = inPath;
  }, [inPath, key]);

  return (
    <details
      className="group/sidebar-folder"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (next !== open) {
          setOpen(next);
          writeOpenState(key, next);
        }
      }}
    >
      <summary
        className={classes(
          itemClass,
          'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
          inPath && 'bg-fd-primary/10 text-fd-primary',
        )}
        style={{ paddingInlineStart: itemOffset(depth - 1) }}
        data-active={inPath}
        title={`Toggle ${label}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {item.icon}
          {item.name}
          <ChevronDown className="ms-auto size-4 shrink-0 -rotate-90 text-fd-muted-foreground transition-transform group-open/sidebar-folder:rotate-0 rtl:rotate-90 rtl:group-open/sidebar-folder:rotate-0" />
        </span>
        {item.index ? (
          <Link
            href={item.index.url}
            {...(typeof item.index.external === 'boolean'
              ? { external: item.index.external }
              : {})}
            title={`Open ${label}`}
            aria-label={`Open ${label}`}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-accent/80 hover:text-fd-accent-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <ArrowUpRight className="size-3.5" />
          </Link>
        ) : null}
      </summary>
      <FolderContent>{children}</FolderContent>
    </details>
  );
}

/** Fumadocs sidebar folder with native, localStorage-persisted disclosure state. */
export function PersistentSidebarFolder({
  item,
  children,
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const inPath = useTreePath().includes(item) || folderContainsPath(item, pathname);
  const indexOnly = item.children.length === 0 && Boolean(item.index);

  return (
    <SidebarFolder collapsible={false} active={false}>
      {indexOnly ? (
        <IndexLink item={item} active={inPath} label={folderLabel(item.name)} />
      ) : (
        <PersistentDetails item={item} inPath={inPath}>
          {children}
        </PersistentDetails>
      )}
    </SidebarFolder>
  );
}

export const DocsSidebarFolder = PersistentSidebarFolder;
