import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { afterNextRender, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { CookiePreferences } from './core/cookie-preferences';
import { AppStore } from './core/app-store';
import { isModuleLoadError, recoveryPath } from './core/navigation-recovery';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly injector = inject(Injector);
  private path = '';
  private focusRevision = 0;
  readonly navigationRecovery = signal<string | null>(null);
  constructor() {
    inject(AppStore);
    const router = inject(Router);
    router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationError && isModuleLoadError(event.error)) {
        this.navigationRecovery.set(recoveryPath(event.url));
      }
      if (event instanceof NavigationEnd) {
        this.navigationRecovery.set(null);
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        if (path === this.path) return;
        this.path = path;
        const revision = ++this.focusRevision;
        afterNextRender(
          () => {
            if (
              revision !== this.focusRevision ||
              document.querySelector('dialog[open]') ||
              document.activeElement?.classList.contains('skip-link')
            )
              return;
            const main = document.getElementById('main');
            const heading = main?.querySelector<HTMLElement>('h1');
            if (heading) {
              heading.tabIndex = -1;
              heading.focus({ preventScroll: true });
            } else main?.focus({ preventScroll: true });
          },
          { injector: this.injector },
        );
      }
    });
  }
  skipToContent(event: Event): void {
    event.preventDefault();
    this.focusRevision++;
    const main = document.getElementById('main');
    main?.focus({ preventScroll: true });
    main?.scrollIntoView({ block: 'start' });
  }
  protected readonly cookies = inject(CookiePreferences);
}
