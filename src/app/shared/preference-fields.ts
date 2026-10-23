import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CATEGORIES,
  DISTRICTS,
  Preferences,
  isCategory,
  isDistrict,
  WorkStyle,
} from '../core/preferences';
import { WorkStyleFields } from './work-style-fields';
@Component({
  selector: 'niva-preference-fields',
  imports: [FormsModule, WorkStyleFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preference-fields.html',
})
export class PreferenceFields {
  readonly accountOwned = input(false);
  readonly value = input.required<Preferences>();
  readonly valueChange = output<Preferences>();
  readonly draft = linkedSignal(() => this.value());
  readonly categories = CATEGORIES;
  readonly districts = DISTRICTS;
  private commit(value: Preferences): void {
    this.draft.set(value);
    this.valueChange.emit(value);
  }
  setRole(value: unknown): void {
    if (value === 'all' || isCategory(value)) this.commit({ ...this.draft(), role: value });
  }
  setDistrict(value: unknown): void {
    if (value === 'all' || isDistrict(value)) this.commit({ ...this.draft(), district: value });
  }
  setStyles(workStyles: WorkStyle[]): void {
    this.commit({ ...this.draft(), workStyles });
  }
  setExclusions(value: string): void {
    this.commit({ ...this.draft(), exclusions: value });
  }
}
