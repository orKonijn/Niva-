import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AccountSession } from './account-session';
export const accountGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AccountSession);
  const router = inject(Router);
  await session.ready;
  await session.refresh();
  return session.user()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });
};
