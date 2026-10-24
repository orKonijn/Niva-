import { DestroyRef, inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
export interface UnsavedPage {
  hasUnsavedChanges(): boolean;
}
export const unsavedGuard: CanDeactivateFn<UnsavedPage> = (page) =>
  !page.hasUnsavedChanges() || window.confirm('יש שינויים שלא נשמרו. לצאת מהעמוד ולאבד את העריכה?');
export function protectUnsaved(check: () => boolean): void {
  const handler = (event: BeforeUnloadEvent) => {
    if (check()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handler);
  inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', handler));
}
