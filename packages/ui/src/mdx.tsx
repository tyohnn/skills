import { Card, Cards } from 'fumadocs-ui/components/card';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

import { Canvas, CanvasLegend } from './components/canvas.tsx';
import { Decision } from './components/decision.tsx';
import { DocKind } from './components/doc-kind.tsx';
import { AdrStatus, DocStatus } from './components/doc-status.tsx';
import { SpecVersion } from './components/spec-version.tsx';

export {
  Card,
  Cards,
  File,
  Files,
  Folder,
  defaultComponents as fumadocsDefaultComponents,
};

/** Fumadocs defaults plus the reusable Oh My Docs document vocabulary. */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    Card,
    Cards,
    File,
    Files,
    Folder,
    Canvas,
    CanvasLegend,
    Decision,
    DocKind,
    DocStatus,
    AdrStatus,
    SpecVersion,
    ...components,
  };
}

export default getMDXComponents;
