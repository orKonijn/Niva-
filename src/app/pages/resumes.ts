import { localDate } from '../core/local-date';
import { protectUnsaved } from '../core/unsaved';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CareerStore } from '../core/career-store';
import type { ResumeVersion } from '../core/models/career';
import { AppStore } from '../core/app-store';
@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './resumes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Resumes {
  readonly localDate = localDate;
  readonly newDate = (value: number) => new Date(value).toISOString();
  readonly career = inject(CareerStore);
  readonly store = inject(AppStore);
  readonly route = inject(ActivatedRoute);
  readonly selected = signal<ResumeVersion | null>(null);
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly jobId = computed(() => this.query().get('job') ?? '');
  readonly job = computed(() => this.store.findJob(this.jobId()));
  private contextGeneration = 0;
  @ViewChild('deleteDialog') private deleteDialog!: ElementRef<HTMLDialogElement>;
  private deleteTrigger: HTMLElement | null = null;
  readonly before = computed(() =>
    this.career.resumes().find((r) => r.id === this.selected()?.parentId),
  );
  name = 'קורות החיים שלי';
  text = '';
  editText = '';
  processingConsent = false;
  reviewed = false;
  private readonly drafts = new Map<string, string>();
  hasUnsavedChanges() {
    return (
      !!this.text.trim() ||
      this.drafts.size > 0 ||
      (!!this.selected() && this.editText !== this.selected()!.text)
    );
  }
  constructor() {
    protectUnsaved(() => this.hasUnsavedChanges());
    effect(() => {
      this.career.session.userId();
      this.career.generation();
      this.drafts.clear();
      this.name = 'קורות החיים שלי';
      this.selected.set(null);
      this.text = '';
      this.editText = '';
      this.processingConsent = false;
      this.reviewed = false;
    });
    effect(() => {
      const versions = this.career.resumes();
      untracked(() => {
        for (const id of this.drafts.keys())
          if (!versions.some((r) => r.id === id)) this.drafts.delete(id);
        const current = this.selected();
        if (!current) return;
        const updated = versions.find((r) => r.id === current.id);
        if (!updated) {
          this.selected.set(null);
          this.editText = '';
          this.reviewed = false;
        } else {
          if (this.editText === current.text) this.editText = updated.text;
          this.selected.set(updated);
        }
      });
    });
    void this.career.refresh();
    effect(() => {
      const id = this.jobId();
      const discovery = this.store.session.config().discovery;
      untracked(() => {
        this.contextGeneration++;
        if (id && discovery) void this.store.ensureJob(id);
      });
    });
  }
  async action(work: () => Promise<void>, current: () => boolean = () => true) {
    if (this.busy()) return;
    this.busy.set(true);
    this.notice.set('');
    try {
      await work();
    } catch (e) {
      if (current()) this.notice.set(e instanceof Error ? e.message : 'הפעולה נכשלה.');
    } finally {
      this.busy.set(false);
    }
  }
  select(resume: ResumeVersion) {
    if (!this.career.resumes().some((r) => r.id === resume.id)) return;
    const old = this.selected();
    if (old?.id === resume.id) {
      this.selected.set(resume);
      return;
    }
    if (old) {
      if (this.editText !== old.text) this.drafts.set(old.id, this.editText);
      else this.drafts.delete(old.id);
    }
    this.selected.set(resume);
    this.editText = this.drafts.get(resume.id) ?? resume.text;
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
    const generation = this.career.generation();
    await this.action(async () => {
      if (file.size > this.career.config().maxUploadBytes) throw new Error('הקובץ גדול מ־750KB.');
      if (!this.processingConsent) throw new Error('יש לאשר את העברת הקובץ לסריקה ופענוח.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (generation !== this.career.generation())
        throw new Error('נתוני החשבון השתנו. יש לבחור מחדש את הקובץ.');
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
      this.drafts.delete(resume.id);
      this.selected.set(null);
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
    const jobId = this.jobId();
    const generation = this.contextGeneration;
    if (!resume || !jobId) return;
    if (this.editText !== resume.text) {
      this.notice.set('יש לשמור ולאשר את העריכה לפני התאמה.');
      return;
    }
    await this.action(
      async () => {
        const result = await this.career.request<ResumeVersion>('tailor', {
          resumeId: resume.id,
          jobId,
        });
        await this.career.load();
        if (generation === this.contextGeneration && this.selected()?.id === resume.id)
          this.select(result);
      },
      () => generation === this.contextGeneration,
    );
  }
  deleteCandidate = signal<string | null>(null);
  askDelete(id: string, event: Event) {
    if (this.busy() || this.deleteCandidate()) return;
    this.deleteTrigger = event.currentTarget as HTMLElement;
    this.deleteCandidate.set(id);
    this.notice.set('');
    this.deleteDialog.nativeElement.showModal();
    this.deleteDialog.nativeElement.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
  }
  cancelDelete(event?: Event) {
    event?.preventDefault();
    if (this.busy()) return;
    this.closeDelete();
  }
  private closeDelete() {
    this.deleteDialog.nativeElement.close();
    this.deleteCandidate.set(null);
    if (this.deleteTrigger?.isConnected) this.deleteTrigger.focus();
  }
  async remove() {
    const id = this.deleteCandidate();
    if (!id) return;
    await this.action(async () => {
      await this.career.request(`resumes/${id}/delete`, {});
      this.closeDelete();
      this.drafts.delete(id);
      if (this.selected()?.id === id) this.selected.set(null);
      await this.career.load();
      this.notice.set(
        'הגרסה, ציונים ושיחות שעשויים להכיל טקסט ממנה נמחקו. גרסאות נגזרות נשמרות ויש למחוק אותן בנפרד.',
      );
    });
  }
}
