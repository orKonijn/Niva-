import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { Icon } from '../shared/icon';
import { PreferenceFields } from '../shared/preference-fields';
import { DemoStore, Preferences } from '../core/demo-store';
import { validateResume } from '../core/resume-validation';
@Component({
  imports: [FormsModule, RouterLink, Brand, Icon, PreferenceFields],
  templateUrl: './onboarding.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Onboarding {
  readonly store = inject(DemoStore);
  readonly router = inject(Router);
  readonly step = signal(0);
  readonly error = signal('');
  readonly filename = signal('');
  readonly dragging = signal(false);
  name = '';
  draft: Preferences = { ...this.store.preferences() };
  agreed = false;
  select(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.validate(file);
    input.value = '';
  }
  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.validate(file);
  }
  private validate(file: File): void {
    const error = validateResume(file);
    this.error.set(error ?? '');
    if (!error) {
      this.filename.set(file.name);
      this.store.resumeName.set(file.name);
    }
  }
  next(): void {
    this.error.set('');
    this.step.update((s) => Math.min(2, s + 1));
  }
  finish(): void {
    if (!this.agreed) {
      this.error.set('כדי להמשיך, יש לאשר שזו סביבת הדגמה.');
      return;
    }
    this.store.name.set(this.name.trim().slice(0, 50));
    this.store.savePreferences(this.draft);
    void this.router.navigateByUrl('/app');
  }
}
