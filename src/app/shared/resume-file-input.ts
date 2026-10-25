import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { readResumeFile } from '../core/resume-file';
@Component({
  selector: 'niva-resume-file-input',
  template: `
    <p class="field-note mb-3">
      PDF / DOCX עד 10MB; PDF עד 20 עמודים. הקובץ נקרא בדפדפן בלבד. הטקסט יוצג לבדיקה לפני שמירה
      בחשבון; קובץ המקור אינו נשלח או נשמר.
    </p>
    <label class="career-field"
      >קובץ לבדיקה<input
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
