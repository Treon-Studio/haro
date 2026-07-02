import katex from 'katex';
import 'katex/dist/katex.min.css'; // Ensure consumers get the CSS if they import this file, though they might need to import it explicitly depending on the bundler

export function renderLatex(content: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(content, {
      displayMode,
      throwOnError: false, // Don't throw errors, render the error message instead
    });
  } catch (e) {
    // Fallback if katex fails completely
    console.error('KaTeX rendering error:', e);
    return `<span class="katex-error" title="KaTeX error">${content}</span>`;
  }
}
