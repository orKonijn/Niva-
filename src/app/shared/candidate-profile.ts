import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStore } from '../core/app-store';
import { emptyCriteria } from '../core/models/discovery';
@Component({
  selector: 'niva-candidate-profile',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section class="account-panel mb-6" aria-label="פרטים לבדיקת התאמה">
    <h2>מה חשוב לדעת כדי לבדוק התאמה?</h2>
    <p>רק פרטים שאישרת משמשים לבדיקה. שדה ריק נשאר לא ידוע. לא מסיקים אישור עבודה מקורות החיים.</p>
    <div class="grid grid-cols-2 gap-4 max-[768px]:grid-cols-1">
      <label class="career-field"
        >כישורים (מופרדים בפסיק)<input [(ngModel)]="skills" maxlength="1000"
      /></label>
      <label class="career-field"
        >שנות ניסיון רלוונטי<input
          type="number"
          min="0"
          max="80"
          [(ngModel)]="value.yearsExperience"
      /></label>
      <label class="career-field"
        >מדינה נוכחית (קוד, למשל IL)<input [(ngModel)]="value.currentCountry" maxlength="2"
      /></label>
      <label class="career-field"
        >מדינה לאישור העבודה (קוד)<input [(ngModel)]="value.authorizationCountry" maxlength="2"
      /></label>
      <label class="career-field"
        >אישור עבודה במדינה שצוינה<select [(ngModel)]="value.workAuthorization">
          <option value="unknown">לא ידוע / לא נמסר</option>
          <option value="authorized">יש אישור</option>
          <option value="not-authorized">אין אישור</option>
        </select></label
      >
      <label class="career-field"
        >צורך בחסות אשרה<select [(ngModel)]="value.sponsorship">
          <option value="unknown">לא ידוע / לא נמסר</option>
          <option value="needed">נדרשת חסות</option>
          <option value="not-needed">לא נדרשת חסות</option>
        </select></label
      >
      <label class="checkbox-label"
        ><input type="checkbox" [(ngModel)]="value.authorizationExclusive" /> אישור העבודה שלי מוגבל
        למדינה שציינתי ואין לי אישור במדינות אחרות</label
      >
      <label class="career-field"
        >מדינה לבדיקת אזרחות (קוד)<input [(ngModel)]="value.citizenshipCountry" maxlength="2"
      /></label>
      <label class="career-field"
        >אזרחות במדינה שצוינה<select [(ngModel)]="value.citizenshipStatus">
          <option value="unknown">לא ידוע / לא נמסר</option>
          <option value="citizen">יש אזרחות</option>
          <option value="not-citizen">אין אזרחות</option>
        </select></label
      >
      <label class="career-field"
        >שפות (מופרדות בפסיק)<input [(ngModel)]="languages" maxlength="1000"
      /></label>
      <label class="career-field"
        >השכלה והסמכות (מופרדות בפסיק)<input [(ngModel)]="qualifications" maxlength="1000"
      /></label>
      <label class="career-field"
        >רישיונות (מופרדים בפסיק)<input [(ngModel)]="licenses" maxlength="1000"
      /></label>
      <label class="career-field"
        >סיווג ביטחוני<select [(ngModel)]="value.clearance">
          <option value="unknown">לא נמסר</option>
          <option value="none">אין סיווג</option>
          <option value="held">יש סיווג (יש לבדוק סוג ותוקף)</option>
        </select></label
      >
      <label class="career-field"
        >שכר מינימום מבוקש<input type="number" min="0" [(ngModel)]="value.salaryMin"
      /></label>
      <label class="career-field"
        >מטבע (למשל ILS)<input [(ngModel)]="value.currency" maxlength="3"
      /></label>
      <label class="career-field"
        >תקופת שכר<select [(ngModel)]="value.period">
          <option [ngValue]="null">לא נמסר</option>
          <option value="hour">שעה</option>
          <option value="month">חודש</option>
          <option value="year">שנה</option>
        </select></label
      >
      <label class="career-field"
        >סוגי העסקה (למשל full-time, contract)<input [(ngModel)]="employmentTypes" maxlength="500"
      /></label>
      <label class="career-field"
        >אזור זמן מועדף<input
          [(ngModel)]="value.timezone"
          maxlength="80"
          placeholder="Asia/Jerusalem"
      /></label>
    </div>
    <label class="checkbox-label"
      ><input type="checkbox" [(ngModel)]="confirmed" /> בדקתי ומאשר/ת את הפרטים האלה</label
    >
    <button
      type="button"
      class="account-button account-primary"
      [disabled]="!confirmed || store.busy() || !store.accountReady()"
      (click)="save()"
    >
      שמירת פרטים לבדיקת התאמה
    </button>
    @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }
  </section>`,
})
export class CandidateProfile {
  readonly store = inject(AppStore);
  value = { ...emptyCriteria(), ...structuredClone(this.store.account().profile.criteria ?? {}) };
  skills = this.value.skills.join(', ');
  languages = this.value.languages.join(', ');
  qualifications = this.value.qualifications.join(', ');
  licenses = this.value.licenses.join(', ');
  employmentTypes = this.value.employmentTypes.join(', ');
  confirmed = false;
  readonly notice = signal('');
  async save() {
    const list = (v: string) =>
      v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    const value = {
      ...this.value,
      confirmed: this.confirmed,
      skills: list(this.skills),
      languages: list(this.languages),
      qualifications: list(this.qualifications),
      licenses: list(this.licenses),
      employmentTypes: list(this.employmentTypes),
      currentCountry: this.value.currentCountry?.trim().toUpperCase() || null,
      authorizationCountry: this.value.authorizationCountry?.trim().toUpperCase() || null,
      citizenshipCountry: this.value.citizenshipCountry?.trim().toUpperCase() || null,
      currency: this.value.currency?.trim().toUpperCase() || null,
      timezone: this.value.timezone?.trim() || null,
    };
    this.notice.set(
      (await this.store.saveCriteria(value))
        ? 'הפרטים נשמרו. ההתאמות חושבו מחדש.'
        : 'לא נשמר. יש לבדוק קודי מדינה, ערכים ואישור הפרטים.',
    );
  }
}
