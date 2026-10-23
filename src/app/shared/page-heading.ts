import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'niva-page-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-heading.html',
  host: { class: 'block' },
})
export class PageHeading {
  readonly kicker = input.required<string>();
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
}
