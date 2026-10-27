import type { DescriptionBlock } from './models/job';
/** Use only source-established block boundaries, never guessed headings. */
export function descriptionBlockText(blocks: DescriptionBlock[]): string {
  return blocks
    .map((b) =>
      b.kind === 'list' ? b.items.map((item) => descriptionBlockText(item)).join('\n') : b.text,
    )
    .join('\n');
}
