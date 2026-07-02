import { describe, it, expect } from 'vitest';
import { extractHeadings, extractLinks, stripMarkdown, extractIdFromPath, generateExcerpt } from '../../src/utils/markdown';
import { estimateTokens } from '../../src/utils/tokenizer';

describe('markdown utils', () => {
  it('extracts headings', () => {
    const md = '# Title\n\n## Section 1\n\n### Sub section\n\n## Section 2';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(4);
    expect(headings[0]).toEqual({ level: 1, text: 'Title', anchor: 'title' });
    expect(headings[1]).toEqual({ level: 2, text: 'Section 1', anchor: 'section-1' });
  });

  it('extracts internal and external links', () => {
    const md = 'See [Auth](okf-002.md) and [RFC](https://tools.ietf.org/html/rfc6749)';
    const links = extractLinks(md);
    expect(links.internal).toContain('okf-002');
    expect(links.external).toContain('https://tools.ietf.org/html/rfc6749');
  });

  it('strips markdown formatting', () => {
    const md = '# Title\n\n**bold** and *italic*';
    const plain = stripMarkdown(md);
    expect(plain).not.toContain('#');
    expect(plain).not.toContain('**');
    expect(plain).not.toContain('*');
  });

  it('extracts id from path', () => {
    expect(extractIdFromPath('docs/okf-001-auth.md')).toBe('okf-001-auth');
    expect(extractIdFromPath('docs/01-fundamentals/okf-010-architecture-overview.md')).toBe('okf-010-architecture-overview');
  });

  it('generates excerpt with truncation', () => {
    const longText = 'A'.repeat(300);
    const excerpt = generateExcerpt(longText, 100);
    expect(excerpt.length).toBeLessThanOrEqual(105);
    expect(excerpt).toMatch(/\.\.\.$/);
  });
});

describe('tokenizer', () => {
  it('estimates tokens correctly', () => {
    expect(estimateTokens('hello world')).toBe(3);
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });
});

describe('link graph building', () => {
  it('builds correct link structures', async () => {
    const { buildLinkGraph } = await import('../../src/kv/index');
    const docs = [
      {
        id: 'okf-001',
        title: 'Auth',
        metadata: { tags: ['security'], category: 'security', context_priority: 1 } as any,
        references: { explicit: ['okf-002'], implicit: [], backlinks: [] },
        content: {} as any,
        sync: {} as any,
      },
      {
        id: 'okf-002',
        title: 'Authorization',
        metadata: { tags: ['security'], category: 'security', context_priority: 1 } as any,
        references: { explicit: [], implicit: [], backlinks: [] },
        content: {} as any,
        sync: {} as any,
      },
    ];

    const graph = buildLinkGraph(docs as any);
    expect(graph['okf-001'].outgoing).toContain('okf-002');
    expect(graph['okf-002'].incoming).toContain('okf-001');
  });
});
