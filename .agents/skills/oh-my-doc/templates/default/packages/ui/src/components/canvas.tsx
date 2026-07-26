'use client';

import '@xyflow/react/dist/style.css';

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { ReactNode } from 'react';

export type CanvasNodeKind = 'input' | 'process' | 'output' | 'external';

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  kind?: CanvasNodeKind;
  handles?: { target?: boolean; source?: boolean };
}

const KIND_STYLE: Record<CanvasNodeKind, string> = {
  input: 'border-sky-500/50 bg-sky-500/5',
  process: 'border-violet-500/50 bg-violet-500/5',
  output: 'border-emerald-500/50 bg-emerald-500/5',
  external: 'border-fd-border bg-fd-muted/30 border-dashed',
};

function DocumentNode({ data }: NodeProps<Node<CanvasNodeData>>) {
  const showTarget = data.handles?.target ?? true;
  const showSource = data.handles?.source ?? true;
  return (
    <div
      className={`min-w-40 rounded-lg border-2 px-3 py-2 shadow-sm ${
        KIND_STYLE[data.kind ?? 'process']
      }`}
    >
      {showTarget ? <Handle type="target" position={Position.Left} /> : null}
      <div className="text-sm font-semibold">{data.label}</div>
      {data.description ? (
        <div className="mt-0.5 text-xs text-fd-muted-foreground">{data.description}</div>
      ) : null}
      {showSource ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

const NODE_TYPES = { document: DocumentNode };

export interface CanvasProps {
  nodes: Array<Node<CanvasNodeData>>;
  edges: Edge[];
  height?: number;
  children?: ReactNode;
}

/** Read-only React Flow canvas tuned for diagrams embedded in documentation. */
export function Canvas({ nodes, edges, height = 420, children }: CanvasProps) {
  return (
    <div className="not-prose bg-fd-card my-6 overflow-hidden rounded-lg border" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: false }}
      >
        <Background bgColor="var(--color-fd-card)" />
        <Controls showInteractive={false} />
        {children}
      </ReactFlow>
    </div>
  );
}

export interface CanvasLegendProps {
  items?: Array<{ kind: CanvasNodeKind; label: string }>;
}

export function CanvasLegend({
  items = [
    { kind: 'input', label: 'Input' },
    { kind: 'process', label: 'Process' },
    { kind: 'output', label: 'Output' },
    { kind: 'external', label: 'External' },
  ],
}: CanvasLegendProps) {
  return (
    <div className="not-prose -mt-4 mb-6 flex flex-wrap gap-4 text-xs text-fd-muted-foreground">
      {items.map(({ kind, label }) => (
        <span key={`${kind}-${label}`} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded border-2 ${KIND_STYLE[kind]}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
