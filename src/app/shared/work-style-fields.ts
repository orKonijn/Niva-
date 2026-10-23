import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { WORK_STYLES, WorkStyle } from '../core/preferences';
let nextId = 0;
@Component({
  selector: 'niva-work-style-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './work-style-fields.html',
})
export class WorkStyleFields {
  readonly value = input.required<WorkStyle[]>();
  readonly valueChange = output<WorkStyle[]>();
  readonly selected = linkedSignal(() => this.value());
  readonly options = WORK_STYLES;
  readonly descriptionId = `work-style-description-${++nextId}`;
  toggle(style: WorkStyle): void {
    const selected = this.selected().includes(style)
      ? this.selected().filter((x) => x !== style)
      : [...this.selected(), style];
    const next = WORK_STYLES.map((x) => x.id).filter((x) => selected.includes(x));
    this.selected.set(next);
    this.valueChange.emit(next);
  }
}
