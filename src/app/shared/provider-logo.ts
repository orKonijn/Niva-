import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'niva-provider-logo',
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './provider-logo.html',
})
export class ProviderLogo {
  readonly provider = input.required<'google' | 'apple'>();
}
