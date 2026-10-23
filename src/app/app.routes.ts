import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Niva — הצעד הבא שלך מתחיל כאן',
    loadComponent: () => import('./pages/home').then((m) => m.Home),
  },
  {
    path: 'signup',
    title: 'מתחילים עם Niva',
    loadComponent: () => import('./pages/onboarding').then((m) => m.Onboarding),
  },
  { path: 'login', redirectTo: 'signup', pathMatch: 'full' },
  {
    path: 'app',
    loadComponent: () => import('./pages/workspace').then((m) => m.Workspace),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'הסקירה שלך — Niva',
        loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'jobs',
        title: 'משרות שמתאימות לך — Niva',
        loadComponent: () => import('./pages/jobs').then((m) => m.Jobs),
      },
      {
        path: 'jobs/:id',
        title: 'בדיקת משרה — Niva',
        loadComponent: () => import('./pages/job-detail').then((m) => m.JobDetail),
      },
      {
        path: 'applications',
        title: 'ההגשות שלך — Niva',
        loadComponent: () => import('./pages/applications').then((m) => m.Applications),
      },
      {
        path: 'preferences',
        title: 'ההעדפות שלך — Niva',
        loadComponent: () => import('./pages/preferences').then((m) => m.PreferencesPage),
      },
      {
        path: 'profile',
        title: 'הפרופיל שלך — Niva',
        loadComponent: () => import('./pages/profile').then((m) => m.Profile),
      },
    ],
  },
  {
    path: 'privacy',
    title: 'פרטיות — Niva',
    loadComponent: () => import('./pages/information').then((m) => m.Information),
  },
  {
    path: 'terms',
    title: 'תנאי הדגמה — Niva',
    loadComponent: () => import('./pages/information').then((m) => m.Information),
  },
  {
    path: 'accessibility',
    title: 'נגישות — Niva',
    loadComponent: () => import('./pages/information').then((m) => m.Information),
  },
  {
    path: '**',
    title: 'העמוד לא נמצא — Niva',
    loadComponent: () => import('./pages/not-found').then((m) => m.NotFound),
  },
];
