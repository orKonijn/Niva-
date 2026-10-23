import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Preferences } from '../core/demo-store';
@Component({
  selector: 'niva-preference-fields',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="form-grid">
    <label
      >תחום שמעניין אותך<select
        name="role"
        [ngModel]="value().role"
        (ngModelChange)="update('role', $event)"
      >
        <option value="all">פתוחים להזדמנויות</option>
        <option value="design">עיצוב וחוויית משתמש</option>
        <option value="engineering">פיתוח תוכנה</option>
        <option value="product">ניהול מוצר</option>
      </select></label
    ><label
      >איפה נוח לך לעבוד?<select
        name="location"
        [ngModel]="value().location"
        (ngModelChange)="update('location', $event)"
      >
        <option value="all">כל המיקומים</option>
        <option>תל אביב</option>
        <option>הרצליה</option>
        <option>חיפה</option>
        <option>מרחוק</option>
      </select></label
    ><label
      >סגנון עבודה<select
        name="model"
        [ngModel]="value().model"
        (ngModelChange)="update('model', $event)"
      >
        <option value="all">כל הסגנונות</option>
        <option>היברידי</option>
        <option>מרחוק</option>
        <option>במשרד</option>
      </select></label
    ><label
      >חברות שעדיף לא להציג <span class="muted">(לא חובה)</span
      ><input
        name="exclusions"
        maxlength="500"
        placeholder="שמות חברות, מופרדים בפסיק"
        [ngModel]="value().exclusions"
        (ngModelChange)="update('exclusions', $event)"
      /><small>למשל: החברה הנוכחית שלך. נשמר רק במכשיר הזה.</small></label
    >
  </div>`,
})
export class PreferenceFields {
  readonly value = input.required<Preferences>();
  readonly valueChange = output<Preferences>();
  update(key: keyof Preferences, value: string): void {
    this.valueChange.emit({ ...this.value(), [key]: value });
  }
}
