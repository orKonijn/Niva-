import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
@Component({
  imports: [RouterLink, Brand],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.html',
})
export class NotFound {}
