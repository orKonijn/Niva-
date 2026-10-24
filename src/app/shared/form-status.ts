import { ChangeDetectionStrategy, Component, input } from '@angular/core';
@Component({
  selector: 'niva-form-status',
  templateUrl: './form-status.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormStatus {
  readonly error = input('');
  readonly success = input('');
  readonly busy = input('');
}
