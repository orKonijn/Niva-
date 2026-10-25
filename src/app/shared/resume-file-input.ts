import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { readResumeFile } from '../core/resume-file';
@Component({
  selector: 'niva-resume-file-input',
  styles: [
    `
      .file-native {
        position: absolute;
        width: 1px;
        height: 1px;
        min-height: 0;
        padding: 0;
        margin: -1px;
        border: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    `,
  ],
  template: `
    <p class="field-note mb-3">
      אפשר לבחור קובץ PDF או DOCX בגודל של עד 10MB. קובץ PDF יכול לכלול עד 20 עמודים. הקריאה נעשית
      במכשיר שלך, וקובץ המקור לא נשלח לשרת ולא נשמר בו. את הטקסט אפשר לבדוק ולתקן לפני השמירה
      בחשבון.
    </p>
    <label
      class="career-field cursor-pointer rounded-control focus-within:outline-2 focus-within:outline-brand focus-within:outline-offset-4"
    >
      <span>קובץ לבדיקה</span>
      <span
        class="mt-2 flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface p-3"
        aria-hidden="true"
      >
        <span class="rounded-control bg-pale px-3 py-2 text-brand">בחירת קובץ</span>
        <span class="min-w-0 break-all text-sm text-muted">{{
          selectedName() || 'לא נבחר קובץ'
        }}</span>
      </span>
      <input
        class="file-native"
        aria-label="קובץ לבדיקה"
        type="file"
        accept=".pdf,.docx"
        [disabled]="disabled() || busy()"
        (change)="select($event)"
    /></label>
    @if (busy()) {
      <p role="status">קוראים את הטקסט מהקובץ…</p>
    }
    @if (error()) {
      <p role="alert" class="form-error">{{ error() }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeFileInput {
  readonly disabled = input(false);
  readonly context = input('');
  readonly loaded = output<{ name: string; text: string }>();
  readonly busy = signal(false);
  readonly selectedName = signal('');
  readonly error = signal('');
  private request = 0;
  ngOnDestroy() {
    this.request++;
  }
  async select(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = '';
    if (!file || this.busy()) return;
    this.selectedName.set(file.name);
    const request = ++this.request;
    const context = this.context();
    this.busy.set(true);
    this.error.set('');
    try {
      const text = await readResumeFile(file);
      if (request === this.request && context === this.context() && !this.disabled())
        this.loaded.emit({ name: file.name, text });
    } catch (error) {
      if (request === this.request)
        this.error.set(
          error instanceof Error ? error.message : 'קריאת הקובץ נכשלה. אפשר להדביק טקסט.',
        );
    } finally {
      if (request === this.request) this.busy.set(false);
    }
  }
}
