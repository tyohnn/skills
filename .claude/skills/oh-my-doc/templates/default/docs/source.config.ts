import { defineConfig, defineDocs, frontmatterSchema, metaSchema } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: { includeProcessedMarkdown: true },
    schema: frontmatterSchema.extend({
      type: z.enum(['conceptual', 'guide', 'reference', 'decision', 'overview']).optional(),
      summary: z.string().optional(),
      related: z.array(z.string()).optional(),
      id: z.string().optional(),
      ticker: z.string().optional(),
      period: z.string().optional(),
      status: z.enum(['draft', 'active', 'done']).optional(),
      stage: z.enum(['draft', 'accepted', 'ready', 'active', 'done', 'superseded', 'locked']).optional(),
      changeType: z.enum(['product', 'bugfix', 'maintenance']).optional(),
      prd: z.string().optional(),
      specs: z.array(z.string()).optional(),
      stories: z.array(z.string()).optional(),
      codeAreas: z.array(z.string()).optional(),
    }),
  },
  meta: { schema: metaSchema },
});

export default defineConfig();
