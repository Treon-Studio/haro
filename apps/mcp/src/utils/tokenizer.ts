const AVG_CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  const cleaned = text.trim();
  if (cleaned.length === 0) return 0;
  return Math.ceil(cleaned.length / AVG_CHARS_PER_TOKEN);
}

export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... truncated to fit token budget ...]';
}

export function formatDocForContext(title: string, content: string): string {
  return `\n## ${title}\n\n${content}\n`;
}

export function formatSummaryDoc(title: string, content: string, maxTokens: number): string {
  const truncated = truncateToTokenBudget(content, maxTokens);
  return `\n### ${title} (summary)\n\n${truncated}\n`;
}
