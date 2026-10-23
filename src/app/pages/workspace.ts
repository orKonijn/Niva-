import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Brand } from '../shared/brand';
import { Icon } from '../shared/icon';
import { DemoStore } from '../core/demo-store';
@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Brand, Icon],
  templateUrl: './workspace.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Workspace {
  readonly store = inject(DemoStore);
  readonly menu = signal(false);
  readonly links = [
    { path: '/app', name: 'סקירה כללית', icon: 'grid', exact: true },
    { path: '/app/jobs', name: 'משרות בשבילך', icon: 'search', exact: false },
    { path: '/app/applications', name: 'ההגשות שלי', icon: 'briefcase', exact: false },
    { path: '/app/profile', name: 'הפרופיל שלי', icon: 'document', exact: false },
    { path: '/app/preferences', name: 'העדפות חיפוש', icon: 'settings', exact: false },
  ];
}
