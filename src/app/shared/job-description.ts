import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { descriptionText } from '../core/description-text';
import type { DescriptionBlock } from '../core/models/job';
/** Legacy text has already lost source markup. Keep visible paragraph/list boundaries without inventing source headings. */
export function legacyDescriptionBlocks(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let paragraph: string[] = [];
  let items: DescriptionBlock[][] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.splice(0).join('\n') });
  };
  const flushList = () => {
    if (items.length) blocks.push({ kind: 'list', ordered: false, items: items.splice(0) });
  };
  for (const line of descriptionText(text).split('\n')) {
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (/^[•*\-]\s/.test(line)) {
      flushParagraph();
      items.push([{ kind: 'paragraph', text: line.replace(/^[•*\-]\s*/, '') }]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
@Component({
  selector: 'niva-job-description',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="job-text min-w-0" dir="auto">
    <ng-container [ngTemplateOutlet]="render" [ngTemplateOutletContext]="{ $implicit: blocks() }" />
    <ng-template #render let-content>
      @for (block of content; track $index) {
        @switch (block.kind) {
          @case ('heading') {
            @switch (headingLevel(block.level)) {
              @case (4) {
                <h4 class="mt-5 mb-2 text-lg font-bold">{{ block.text }}</h4>
              }
              @case (5) {
                <h5 class="mt-5 mb-2 text-lg font-bold">{{ block.text }}</h5>
              }
              @case (6) {
                <h6 class="mt-5 mb-2 text-lg font-bold">{{ block.text }}</h6>
              }
              @default {
                <h3 class="mt-5 mb-2 text-lg font-bold">{{ block.text }}</h3>
              }
            }
          }
          @case ('paragraph') {
            <p class="mb-3 whitespace-pre-line">{{ block.text }}</p>
          }
          @case ('list') {
            @if (block.ordered) {
              <ol class="list-decimal ps-6 mb-4">
                @for (item of block.items; track $index) {
                  <li class="mb-2">
                    <ng-container
                      [ngTemplateOutlet]="render"
                      [ngTemplateOutletContext]="{ $implicit: item }"
                    />
                  </li>
                }
              </ol>
            } @else {
              <ul class="list-disc ps-6 mb-4">
                @for (item of block.items; track $index) {
                  <li class="mb-2">
                    <ng-container
                      [ngTemplateOutlet]="render"
                      [ngTemplateOutletContext]="{ $implicit: item }"
                    />
                  </li>
                }
              </ul>
            }
          }
        }
      }
    </ng-template>
  </div>`,
})
export class JobDescription {
  readonly text = input.required<string>();
  readonly sourceBlocks = input<DescriptionBlock[]>();
  readonly blocks = computed<DescriptionBlock[]>(() =>
    this.sourceBlocks()?.length ? this.sourceBlocks()! : legacyDescriptionBlocks(this.text()),
  );
  headingLevel(level: number) {
    return Math.max(3, Math.min(6, level + 1));
  }
}
