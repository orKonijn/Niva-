import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import { decodeHTML } from 'entities';
import type { DescriptionBlock } from '../src/app/core/models/job';
import { descriptionText } from '../src/app/core/description-text';
type Node = DefaultTreeAdapterTypes.ChildNode;
const excluded = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'svg',
  'noscript',
  'template',
  'form',
]);
/** Only inert bounded text and source structure leave the parser. Never serialize provider HTML. */
export function descriptionBlocks(value: unknown): DescriptionBlock[] {
  let html = typeof value === 'string' ? value.slice(0, 100000) : '';
  for (let n = 0; n < 5; n++) {
    const next = decodeHTML(html);
    if (next === html) break;
    html = next;
  }
  let budget = 18000,
    nodes = 0;
  const clean = (s: string) => {
    const result = descriptionText(s).slice(0, Math.max(0, budget));
    budget -= result.length;
    return result;
  };
  const inline = (node: Node, depth: number): string => {
    if (depth > 30 || ++nodes > 12000) return '';
    if (node.nodeName === '#text') return (node as DefaultTreeAdapterTypes.TextNode).value;
    if (!('tagName' in node) || excluded.has(node.tagName)) return '';
    if (node.tagName === 'br') return '\n';
    return node.childNodes.map((n) => inline(n, depth + 1)).join('');
  };
  const walk = (children: Node[], depth = 0): DescriptionBlock[] => {
    if (depth > 30 || budget <= 0) return [];
    const blocks: DescriptionBlock[] = [];
    let pending = '';
    const flush = () => {
      const text = clean(pending);
      if (text) blocks.push({ kind: 'paragraph', text });
      pending = '';
    };
    for (const node of children) {
      if (++nodes > 12000 || budget <= 0) break;
      if (node.nodeName === '#text') {
        pending += (node as DefaultTreeAdapterTypes.TextNode).value;
        continue;
      }
      if (!('tagName' in node) || excluded.has(node.tagName)) continue;
      const tag = node.tagName;
      if (/^h[1-6]$/.test(tag)) {
        flush();
        const text = clean(node.childNodes.map((n) => inline(n, depth + 1)).join(''));
        if (text) blocks.push({ kind: 'heading', level: Number(tag[1]), text });
      } else if (tag === 'ul' || tag === 'ol') {
        flush();
        const items = node.childNodes
          .filter((n) => 'tagName' in n && n.tagName === 'li')
          .map((n) => walk((n as DefaultTreeAdapterTypes.Element).childNodes, depth + 1))
          .filter((x) => x.length);
        if (items.length) blocks.push({ kind: 'list', ordered: tag === 'ol', items });
      } else if (
        ['p', 'div', 'section', 'article', 'blockquote', 'table', 'tr', 'li'].includes(tag)
      ) {
        flush();
        blocks.push(...walk(node.childNodes, depth + 1));
      } else if (tag === 'br' || tag === 'hr') {
        flush();
      } else pending += inline(node, depth + 1);
    }
    flush();
    return blocks;
  };
  return walk(parseFragment(html).childNodes);
}
