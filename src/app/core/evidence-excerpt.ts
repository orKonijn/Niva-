/** Bounded excerpts at whitespace boundaries; ellipses disclose omitted context. */
export function evidenceExcerpt(text: string, index = 0, limit = 300): string {
  if (text.length <= limit) return text;
  let start = Math.max(0, index - 60);
  while (start > 0 && !/\s/u.test(text[start - 1])) start--;
  let end = Math.min(text.length, start + limit - 2);
  while (end > index && end < text.length && !/\s/u.test(text[end])) end--;
  // A single oversized token is not safe to excerpt; expose no broken token.
  if (end <= index) return '…';
  return `${start ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
