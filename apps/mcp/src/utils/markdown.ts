export interface ParsedHeading {
  level: number;
  text: string;
  anchor: string;
}

export interface ParsedLinks {
  internal: string[];
  external: string[];
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/gm;
const INTERNAL_LINK_RE = /\[([^\]]*)\]\((okf-\d+(?:-[a-z0-9]+)?(?:\.md)?)\)/gi;
const EXTERNAL_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi;
const STRIP_MD_RE = /[#*_~`>\[\]|]/g;
const MULTI_NEWLINE_RE = /\n{3,}/g;

export function stripMarkdown(md: string): string {
  return md
    .replace(STRIP_MD_RE, '')
    .replace(MULTI_NEWLINE_RE, '\n\n')
    .trim();
}

export function extractHeadings(md: string): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  let match: RegExpExecArray | null;

  while ((match = HEADING_RE.exec(md)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const anchor = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ level, text, anchor });
  }

  return headings;
}

export function extractLinks(md: string): ParsedLinks {
  const internal: string[] = [];
  const external: string[] = [];
  let match: RegExpExecArray | null;

  const seen = new Set<string>();

  while ((match = INTERNAL_LINK_RE.exec(md)) !== null) {
    const ref = match[2].replace(/\.md$/, '');
    if (!seen.has(ref)) {
      seen.add(ref);
      internal.push(ref);
    }
  }

  while ((match = EXTERNAL_LINK_RE.exec(md)) !== null) {
    const url = match[2];
    if (!seen.has(url)) {
      seen.add(url);
      external.push(url);
    }
  }

  return { internal, external };
}

export function extractIdFromPath(path: string): string {
  const basename = path.split('/').pop() || '';
  return basename.replace(/\.md$/, '');
}

export function generateExcerpt(text: string, maxLength = 200): string {
  const cleaned = stripMarkdown(text);
  if (cleaned.length <= maxLength) return cleaned;
  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

export function createAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}
