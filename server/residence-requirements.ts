/** Deliberately limited vocabulary. An unsupported list stays unresolved as a
 * whole, rather than excluding somebody based on its first recognised country. */
export function residenceCountries(clauses: string[]) {
  const codes: Record<string, string> = {
    italy: 'IT',
    israel: 'IL',
    'united states': 'US',
    'united kingdom': 'GB',
    canada: 'CA',
    germany: 'DE',
    portugal: 'PT',
    spain: 'ES',
    france: 'FR',
    ireland: 'IE',
    netherlands: 'NL',
    poland: 'PL',
  };
  const conditions: string[] = [];
  const lists: string[][] = [];
  for (const quote of clauses) {
    const match =
      /\b(?:must\s+(?:be\s+)?(?:physically\s+)?(?:based|located|living|residing)|must\s+(?:reside|live|be)|only applicants(?:\s+(?:based|located))?)\s+(?:in|within)\s+(.+)/i.exec(
        quote,
      );
    if (!match || /\b(?:not|no|optional|preferred|bonus)\b/i.test(quote)) continue;
    if (/^(?:the\s+)?Schengen\s+(?:Area|Zone)[.!]?$/i.test(match[1])) continue;
    conditions.push(quote);
    const pieces = match[1]
      .replace(/[.!]$/, '')
      .split(/\s*,\s*|\s+(?:or|and)\s+/i)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (pieces.length && pieces.every((s) => codes[s])) lists.push(pieces.map((s) => codes[s]));
  }
  // Multiple differing statements may describe separate roles or alternatives.
  const distinct = [...new Set(lists.map((a) => [...new Set(a)].sort().join(',')))];
  return {
    conditions,
    countries:
      conditions.length === lists.length && distinct.length === 1 ? [...new Set(lists[0])] : null,
  };
}
