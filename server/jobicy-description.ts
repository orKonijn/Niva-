import { parse, serialize, type DefaultTreeAdapterTypes as Tree } from 'parse5';
import type { Job } from '../src/app/core/models/job';
import { descriptionBlocks } from './description-blocks';
import { descriptionBlockText } from '../src/app/core/description-block-text';
import { descriptionText } from '../src/app/core/description-text';

/** Read the already requested trusted original within a fixed memory bound. */
export async function boundedHtml(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0,
    html = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return html + decoder.decode();
      bytes += value.byteLength;
      if (bytes > 1_000_000) return null;
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}

/** Identity and source container must agree. No provider markup reaches the UI. */
export function jobicyDescription(html: string, job: Job) {
  if (html.length > 1_000_000) return null;
  const root = parse(html);
  const postings: Record<string, unknown>[] = [];
  const containers: Tree.Element[] = [];
  let nodes = 0;
  const json = (value: unknown, depth = 0) => {
    if (depth > 10 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.slice(0, 100).forEach((v) => json(v, depth + 1));
      return;
    }
    const row = value as Record<string, unknown>;
    if (row['@type'] === 'JobPosting') postings.push(row);
    if (row['@graph']) json(row['@graph'], depth + 1);
  };
  const walk = (node: Tree.Node, depth = 0) => {
    if (++nodes > 30000 || depth > 60) return;
    if ('tagName' in node) {
      if (node.attrs.some((a) => a.name === 'id' && a.value === 'jv-full-description'))
        containers.push(node);
      if (
        node.tagName === 'script' &&
        node.attrs.some((a) => a.name === 'type' && a.value === 'application/ld+json')
      ) {
        const text = node.childNodes
          .filter((n): n is Tree.TextNode => n.nodeName === '#text')
          .map((n) => n.value)
          .join('');
        if (text.length < 200000)
          try {
            json(JSON.parse(text));
          } catch {
            /* Invalid metadata cannot authorize replacement. */
          }
      }
    }
    if ('childNodes' in node) node.childNodes.forEach((n) => walk(n, depth + 1));
  };
  walk(root);
  const normalize = (s: string) =>
    descriptionText(s)
      .normalize('NFC')
      .replace(/[\u2010-\u2015\u2212]/gu, '-')
      .replace(/\s+/gu, ' ')
      .trim()
      .toLowerCase();
  const id = job.id.split('-').at(-1);
  if (nodes > 30000 || containers.length !== 1 || postings.length !== 1) return null;
  const row = postings[0];
  const identifier = row['identifier'];
  if (
    !identifier ||
    typeof identifier !== 'object' ||
    String((identifier as Record<string, unknown>)['value']) !== id ||
    typeof row['title'] !== 'string' ||
    normalize(row['title']) !== normalize(job.title)
  )
    return null;
  const blocks = descriptionBlocks(serialize(containers[0]));
  const text = descriptionBlockText(blocks);
  return text ? { description: text, descriptionBlocks: blocks } : null;
}
