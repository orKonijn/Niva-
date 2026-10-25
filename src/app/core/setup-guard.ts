import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AccountSession } from './account-session';
import { AppStore } from './app-store';
import { CareerStore } from './career-store';
export const setupGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AccountSession),
    store = inject(AppStore),
    career = inject(CareerStore),
    router = inject(Router);
  await session.ready;
  if (!session.config().setupRequired) return true;
  if (!session.user())
    return router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });
  await store.refresh();
  await career.refresh();
  return store.accountReady() &&
    !career.error() &&
    career.active() &&
    store.account().setupCompleted
    ? true
    : router.createUrlTree(['/setup'], { queryParams: { returnTo: state.url } });
};
export const setupEntryGuard: CanActivateFn = async () => {
  const session = inject(AccountSession),
    router = inject(Router);
  await session.ready;
  return !session.config().setupRequired
    ? true
    : router.createUrlTree([session.user() ? '/setup' : '/login']);
};
