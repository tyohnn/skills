import { DocKind, docKindFromSlug } from '@oh-my-docs/ui/doc-kind';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  createRelativeLink,
} from '@oh-my-docs/ui/fumadocs';
import { DocsInlineToc } from '@oh-my-docs/ui/inline-toc';
import { getMDXComponents } from '@oh-my-docs/ui/mdx';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { catalogFooterItems, catalogIndexLink, source } from '@/lib/source';

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  const kind = docKindFromSlug(slug);
  const ticker = typeof page.data.ticker === 'string' ? page.data.ticker : undefined;
  const footerItems = catalogFooterItems(slug);
  const indexLink = catalogIndexLink(slug);

  return (
    <DocsPage
      toc={page.data.toc}
      {...(page.data.full ? { full: true } : {})}
      {...(footerItems ? { footer: { items: footerItems } } : {})}
    >
      {indexLink ? (
        <Link
          href={indexLink.href}
          className="-mt-1 inline-flex w-fit items-center rounded-lg border px-2.5 py-1.5 text-sm text-fd-muted-foreground no-underline transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
        >
          <span aria-hidden>←</span>&nbsp;{indexLink.label}
        </Link>
      ) : null}
      <DocsTitle>
        <span className="inline-flex flex-wrap items-center gap-2">
          {kind ? <DocKind kind={kind} {...(ticker ? { ticker } : {})} /> : null}
          {page.data.title}
        </span>
      </DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsInlineToc items={page.data.toc} />
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
