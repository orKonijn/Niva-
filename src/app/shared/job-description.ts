import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { descriptionText } from '../core/description-text';
type Block = { kind: 'heading' | 'paragraph'; text: string } | { kind: 'list'; items: string[] };
@Component({
  selector: 'niva-job-description',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="job-text min-w-0" dir="auto">
    @for (block of blocks(); track $index) {
      @switch (block.kind) {
        @case ('heading') {
          <h3 class="mt-5 mb-2 text-lg">{{ block.text }}</h3>
        }
        @case ('paragraph') {
          <p class="mb-3 whitespace-pre-line">{{ block.text }}</p>
        }
        @case ('list') {
          <ul class="list-disc ps-6 mb-4">
            @for (item of block.items; track $index) {
              <li class="mb-2">{{ item }}</li>
            }
          </ul>
        }
      }
    }
  </div>`,
})
export class JobDescription {
  readonly text = input.required<string>();
  readonly blocks = computed(() => {
    const blocks: Block[] = [],
      paragraph: string[] = [],
      items: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length)
        blocks.push({ kind: 'paragraph', text: paragraph.splice(0).join('\n') });
    };
    const flushList = () => {
      if (items.length) blocks.push({ kind: 'list', items: items.splice(0) });
    };
    for (const line of descriptionText(this.text()).split('\n')) {
      if (!line.trim()) {
        flushParagraph();
        continue;
      }
      if (
        line.length < 120 &&
        /^(?:requirements|qualifications|responsibilities|benefits|bonus(?: points)?|nice.to.have|what (?:we|you)|who you are|about (?:the|us)|the role|role description|דרישות|תחומי אחריות|תיאור התפקיד|יתרונות)/i.test(
          line,
        )
      ) {
        flushParagraph();
        flushList();
        blocks.push({ kind: 'heading', text: line });
      } else if (/^[•*\-]\s/.test(line)) {
        flushParagraph();
        items.push(line.replace(/^[•*\-]\s*/, ''));
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
    return blocks;
  });
}
