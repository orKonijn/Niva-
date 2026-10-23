import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeControl } from './theme-control';
@Component({
  selector: 'niva-brand',
  imports: [RouterLink, ThemeControl],
  templateUrl: './brand.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Brand {}
