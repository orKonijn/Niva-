/** Israel local time; callers retain the original ISO timestamp in title/details. */
export function localDate(value: string | undefined | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'לא נמסר';
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
