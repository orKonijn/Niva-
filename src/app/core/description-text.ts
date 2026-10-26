import { decodeHTML } from 'entities';
/** Untrusted provider markup becomes text only. Never return executable HTML. */
export function descriptionText(value: unknown): string {
  let text = typeof value === 'string' ? value.slice(0, 1_000_000) : '';
  for (let n = 0; n < 5; n++) {
    const decoded = decodeHTML(text);
    if (decoded === text) break;
    text = decoded;
  }
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|svg|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/?(?:p|div|section|article|h[1-6]|ul|ol|br|hr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '')
    .replace(/[\t\f\v \u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 18_000);
}
