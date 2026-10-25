import {
  afterNextRender,
  Injector,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { ResumeFileInput } from '../shared/resume-file-input';
import { PreferenceFields } from '../shared/preference-fields';
import { AppStore } from '../core/app-store';
import { CareerStore } from '../core/career-store';
import { safeReturn } from '../core/account-session';
import { checkedResumeText } from '../core/resume-file';
import { protectUnsaved } from '../core/unsaved';
import type { ResumeVersion } from '../core/models/career';
@Component({
  imports: [FormsModule, RouterLink, Brand, ResumeFileInput, PreferenceFields],
  templateUrl: './setup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Setup {
  private readonly injector = inject(Injector);
  readonly store = inject(AppStore);
  readonly career = inject(CareerStore);
  readonly router = inject(Router);
  readonly returnTo = safeReturn(inject(ActivatedRoute).snapshot.queryParamMap.get('returnTo'));
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly step = signal(0);
  readonly stored = signal(false);
  text = '';
  name = 'קורות החיים שלי';
  reviewed = false;
  draft = { ...this.store.preferences() };
  private savedDraft: ResumeVersion | null = null;
  private owner = this.store.session.userId();
  private baseline = '';
  constructor() {
    protectUnsaved(() => this.hasUnsavedChanges());
    effect(() => {
      const owner = this.store.session.userId();
      if (owner !== this.owner)
        untracked(() => {
          this.owner = owner;
          this.text = '';
          this.reviewed = false;
          this.savedDraft = null;
          this.baseline = '';
          this.stored.set(false);
          this.step.set(0);
          void this.router.navigateByUrl('/login');
        });
    });
    void this.initialize();
  }
  hasUnsavedChanges() {
    return (
      !this.stored() &&
      (!!this.text.trim() || (this.step() === 1 && JSON.stringify(this.draft) !== this.baseline))
    );
  }
  async initialize() {
    this.loading.set(true);
    this.error.set('');
    await this.store.refresh();
    await this.career.refresh();
    if (!this.store.accountReady() || this.career.error())
      this.error.set('לא ניתן לטעון את ההגדרה. יש לבדוק את החיבור ולנסות שוב.');
    else {
      this.draft = { ...this.store.preferences() };
      this.baseline = JSON.stringify(this.draft);
      if (this.career.active()) this.step.set(1);
      if (this.career.active() && this.store.account().setupCompleted) {
        this.stored.set(true);
        void this.router.navigateByUrl(this.returnTo);
      }
    }
    this.loading.set(false);
  }
  importFile(value: { name: string; text: string }) {
    this.name = value.name;
    this.text = value.text;
    this.reviewed = false;
  }
  async saveResume() {
    if (this.busy() || !this.reviewed) return;
    this.busy.set(true);
    this.error.set('');
    const owner = this.owner,
      generation = this.career.generation();
    try {
      const text = checkedResumeText(this.text);
      if (!this.savedDraft || this.savedDraft.text !== text)
        this.savedDraft = await this.career.request<ResumeVersion>('resumes', {
          name: this.name,
          text,
        });
      this.savedDraft = await this.career.request<ResumeVersion>(
        `resumes/${this.savedDraft.id}/review`,
        { text, confirmed: true },
      );
      await this.career.request(`resumes/${this.savedDraft.id}/activate`, { confirmed: true });
      await this.career.load(true);
      if (owner !== this.owner || generation !== this.career.generation()) return;
      if (!this.career.active()) throw new Error('קורות החיים לא הופעלו. יש לנסות שוב.');
      this.text = '';
      this.reviewed = false;
      this.step.set(1);
      afterNextRender(() => document.querySelector<HTMLElement>('#setup-preferences')?.focus(), {
        injector: this.injector,
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'השמירה נכשלה. הטקסט נשאר כאן.');
    } finally {
      this.busy.set(false);
    }
  }
  async finish() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    await this.career.refresh();
    if (!this.career.active()) {
      this.step.set(0);
      this.error.set('יש להוסיף ולאשר קורות חיים לפני בחירת ההעדפות.');
    } else if (await this.store.completeSetup(this.draft)) {
      this.stored.set(true);
      void this.router.navigateByUrl(this.returnTo);
    } else this.error.set('ההעדפות לא נשמרו. הבחירות נשארו כאן; יש לנסות שוב.');
    this.busy.set(false);
  }
}
