import { protectUnsaved } from '../core/unsaved';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CareerStore } from '../core/career-store';
import type { ResumeVersion } from '../core/models/career';
import { AppStore } from '../core/app-store';
@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './resumes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Resumes {
  readonly career = inject(CareerStore);
  readonly store = inject(AppStore);
  readonly route = inject(ActivatedRoute);
  readonly selected = signal<ResumeVersion | null>(null);
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly jobId = this.route.snapshot.queryParamMap.get('job') ?? '';
  readonly job = computed(() => this.store.findJob(this.jobId));
  readonly before = computed(() =>
    this.career.resumes().find((r) => r.id === this.selected()?.parentId),
  );
  name = 'קורות החיים שלי';
  text = '';
  editText = '';
  processingConsent = false;
  reviewed = false;
  hasUnsavedChanges() {
    return !!this.text.trim() || (!!this.selected() && this.editText !== this.selected()!.text);
  }
  constructor() {
    protectUnsaved(() => this.hasUnsavedChanges());
    effect(() => {
      this.career.session.userId();
      this.selected.set(null);
      this.text = '';
      this.editText = '';
      this.processingConsent = false;
      this.reviewed = false;
    });
    if (this.jobId) void this.store.ensureJob(this.jobId);
  }
  async action(work: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.notice.set('');
    try {
      await work();
    } catch (e) {
      this.notice.set(e instanceof Error ? e.message : 'הפעולה נכשלה.');
    } finally {
      this.busy.set(false);
    }
  }
  select(resume: ResumeVersion) {
    if (!this.career.resumes().some((r) => r.id === resume.id)) return;
    this.selected.set(resume);
    this.editText = resume.text;
    this.reviewed = false;
  }
  async create() {
    await this.action(async () => {
      const resume = await this.career.request<ResumeVersion>('resumes', {
        name: this.name,
        text: this.text,
      });
      await this.career.load();
      this.select(resume);
      this.text = '';
    });
  }
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.action(async () => {
      if (file.size > this.career.config().maxUploadBytes) throw new Error('הקובץ גדול מ־750KB.');
      if (!this.processingConsent) throw new Error('יש לאשר את העברת הקובץ לסריקה ופענוח.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      const resume = await this.career.request<ResumeVersion>('resumes', {
        name: file.name,
        mime: file.type,
        base64: btoa(binary),
        processingConsent: true,
      });
      await this.career.load();
      this.select(resume);
    });
  }
  async review() {
    const resume = this.selected();
    if (!resume || !this.reviewed) return;
    await this.action(async () => {
      const result = await this.career.request<ResumeVersion>(`resumes/${resume.id}/review`, {
        text: this.editText,
        confirmed: true,
      });
      await this.career.load();
      this.select(result);
      this.notice.set('העובדות אושרו. הפעלה דורשת בחירה נפרדת.');
    });
  }
  async activate() {
    const resume = this.selected();
    if (!resume || !this.reviewed) return;
    await this.action(async () => {
      await this.career.request(`resumes/${resume.id}/activate`, { confirmed: true });
      await this.career.load();
      this.select(this.career.resumes().find((r) => r.id === resume.id)!);
      this.notice.set('הגרסה הפעילה עודכנה לפי בחירתך.');
    });
  }
  async tailor() {
    const resume = this.selected();
    if (!resume) return;
    await this.action(async () => {
      const result = await this.career.request<ResumeVersion>('tailor', {
        resumeId: resume.id,
        jobId: this.jobId,
      });
      await this.career.load();
      this.select(result);
    });
  }
  deleteCandidate = signal<string | null>(null);
  async remove() {
    const id = this.deleteCandidate();
    if (!id) return;
    await this.action(async () => {
      await this.career.request(`resumes/${id}/delete`, {});
      this.deleteCandidate.set(null);
      if (this.selected()?.id === id) this.selected.set(null);
      await this.career.load();
      this.notice.set(
        'הגרסה, ציונים ושיחות שעשויים להכיל טקסט ממנה נמחקו. גרסאות נגזרות נשמרות ויש למחוק אותן בנפרד.',
      );
    });
  }
}
