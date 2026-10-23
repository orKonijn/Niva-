import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
@Component({
  imports: [RouterLink, Brand],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<header class="container simple-header"><niva-brand /></header><main id="main" class="empty-state not-found"><span class="section-kicker">404</span><h1>לפעמים צריך כיוון חדש.</h1><p>העמוד שחיפשת לא נמצא. אפשר להתחיל שוב מדף הבית.</p><a routerLink="/" class="button">בחזרה לבית</a></main>',
})
export class NotFound {}
