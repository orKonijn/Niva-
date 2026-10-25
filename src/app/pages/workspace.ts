import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ElementRef, HostListener, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Brand } from '../shared/brand';
import { Icon } from '../shared/icon';
import { AppStore } from '../core/app-store';
@Component({
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, Brand, Icon],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Workspace {
  readonly store = inject(AppStore);
  readonly failedPhoto = signal('');
  readonly photoKey = computed(() =>
    JSON.stringify([this.store.session.userId(), this.store.session.user()?.image]),
  );
  readonly photo = computed(() => {
    if (this.failedPhoto() === this.photoKey()) return '';
    try {
      const url = new URL(this.store.session.user()?.image ?? '');
      return url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.port &&
        (url.hostname === 'googleusercontent.com' ||
          url.hostname.endsWith('.googleusercontent.com'))
        ? url.href
        : '';
    } catch {
      return '';
    }
  });
  readonly menu = signal(false);
  readonly drawer = viewChild.required<ElementRef<HTMLDialogElement>>('drawer');
  private trigger: HTMLElement | null = null;
  openMenu(event: Event): void {
    this.trigger = event.currentTarget as HTMLElement;
    this.menu.set(true);
    this.drawer().nativeElement.showModal();
    this.drawer()
      .nativeElement.querySelector<HTMLButtonElement>('[aria-label="סגירת תפריט"]')
      ?.focus();
  }
  closeMenu(): void {
    this.drawer().nativeElement.close();
    this.menu.set(false);
    this.trigger?.focus();
  }
  backdrop(event: MouseEvent): void {
    if (event.target === this.drawer().nativeElement) this.closeMenu();
  }
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      this.drawer().nativeElement.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'),
    ).filter((element) => element.getClientRects().length);
    if (!controls.length) return;
    event.preventDefault();
    const index = controls.indexOf(document.activeElement as HTMLElement);
    controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
  }
  @HostListener('window:resize') resized(): void {
    if (window.innerWidth > 767 && this.menu()) this.closeMenu();
  }
  readonly links = [
    { path: '/app', name: 'סקירה כללית', icon: 'grid', exact: true },
    { path: '/app/jobs', name: 'משרות בשבילך', icon: 'search', exact: false },
    { path: '/app/applications', name: 'ההגשות שלי', icon: 'briefcase', exact: false },
    { path: '/app/assistant', name: 'העוזרת שלך', icon: 'sparkles', exact: false },
    { path: '/app/resumes', name: 'קורות חיים', icon: 'document', exact: false },
    { path: '/app/profile', name: 'הפרופיל שלי', icon: 'document', exact: false },
    { path: '/app/preferences', name: 'העדפות חיפוש', icon: 'settings', exact: false },
  ];
}
