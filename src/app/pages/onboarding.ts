import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { afterNextRender, Injector } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { Icon } from '../shared/icon';
import { PreferenceFields } from '../shared/preference-fields';
import { AppStore, Preferences } from '../core/app-store';
import { districtLabel, workStylesLabel, categoryLabel } from '../core/preferences';
import { validateResume } from '../core/resume-validation';
@Component({
  imports: [FormsModule, RouterLink, Brand, Icon, PreferenceFields],
  templateUrl: './onboarding.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Onboarding {
  readonly districtLabel = districtLabel;
  readonly workStylesLabel = workStylesLabel;
  readonly categoryLabel = categoryLabel;
  readonly store = inject(AppStore);
  readonly router = inject(Router);
  readonly step = signal(0);
  readonly error = signal('');
  readonly filename = signal(this.store.resumeName());
  private readonly injector = inject(Injector);
  readonly dragging = signal(false);
  readonly saving = signal(false);
  name = this.store.name();
  readonly draftGeneration = this.store.resetGeneration;
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
    }
  }
  next(): void {
    this.error.set('');
    this.go(Math.min(2, this.step() + 1));
  }
  go(step: number): void {
    this.step.set(step);
    afterNextRender(() => document.querySelector<HTMLElement>('.step-content h2')?.focus(), {
      injector: this.injector,
    });
  }
  async finish(): Promise<void> {
    if (this.saving()) return;
    if (!this.agreed) {
      this.error.set('כדי להמשיך, יש לאשר שזו סביבת הדגמה.');
      return;
    }
    this.saving.set(true);
    if (!(await this.store.savePreferences(this.draft, this.draftGeneration))) {
      this.error.set('ההעדפות לא נשמרו. יש לפתוח את ההגדרה מחדש ולנסות שוב.');
      this.saving.set(false);
      return;
    }
    if (!(await this.store.saveProfile(this.name.trim().slice(0, 50)))) {
      this.error.set('ההעדפות נשמרו, אך הפרופיל לא נשמר. הפרטים נשארו כאן; נסו שוב.');
      this.saving.set(false);
      return;
    }
    this.store.resumeName.set(this.filename());
    void this.router.navigateByUrl('/app');
    this.saving.set(false);
  }
}
