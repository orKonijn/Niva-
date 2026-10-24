import { Routes } from '@angular/router';
import { accountGuard } from './core/account-guard';
import { unsavedGuard } from './core/unsaved';

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
  {
    path: 'login',
    title: 'כניסה לחשבון — Niva',
    data: { mode: 'login' },
    loadComponent: () => import('./pages/auth').then((m) => m.AuthPage),
  },
  {
    path: 'register',
    title: 'יצירת חשבון — Niva',
    data: { mode: 'register' },
    loadComponent: () => import('./pages/auth').then((m) => m.AuthPage),
  },
  {
    path: 'forgot-password',
    title: 'איפוס סיסמה — Niva',
    data: { mode: 'forgot' },
    loadComponent: () => import('./pages/auth').then((m) => m.AuthPage),
  },
  {
    path: 'reset-password',
    title: 'סיסמה חדשה — Niva',
    data: { mode: 'reset' },
    loadComponent: () => import('./pages/auth').then((m) => m.AuthPage),
  },
  {
    path: 'account',
    title: 'החשבון שלי — Niva',
    canActivate: [accountGuard],
    loadComponent: () => import('./pages/account').then((m) => m.AccountPage),
  },
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
        path: 'assistant',
        title: 'העוזרת שלך — Niva',
        canActivate: [accountGuard],
        loadComponent: () => import('./pages/assistant').then((m) => m.Assistant),
      },
      {
        path: 'resumes',
        canDeactivate: [unsavedGuard],
        title: 'קורות החיים שלך — Niva',
        canActivate: [accountGuard],
        loadComponent: () => import('./pages/resumes').then((m) => m.Resumes),
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
        canDeactivate: [unsavedGuard],
        title: 'ההעדפות שלך — Niva',
        loadComponent: () => import('./pages/preferences').then((m) => m.PreferencesPage),
      },
      {
        path: 'profile',
        canDeactivate: [unsavedGuard],
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
    title: 'תנאי השימוש — Niva',
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
