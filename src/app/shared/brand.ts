import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'niva-brand',
  imports: [RouterLink],
  template:
    '<a routerLink="/" class="brand" aria-label="Niva דף הבית"><span class="brand-mark">n</span><span dir="ltr">niva<span class="brand-dot">.</span></span></a>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Brand {}
