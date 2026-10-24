import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Job } from '../core/models/job';
import { preferenceMatch, resumeMatch } from '../core/matching';
import { AppStore } from '../core/app-store';
import { CareerStore } from '../core/career-store';
@Component({
  selector: 'niva-match-indicator',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <details class="match-panel">
    <summary>{{ preference().label }} · {{ resume().label }}</summary>
    <p>דרישות הסינון הן תנאי להצגה, בנפרד ממונחים בקורות החיים. אין חיזוי סיכויי קבלה.</p>
    @for (factor of preference().factors; track factor.label) {
      <p>{{ factor.label }}: {{ status(factor.status) }}</p>
    }
    @if (preference().excluded) {
      <p>המעסיק ברשימת ההחרגות.</p>
    }
    <p>ותק, השכלה ואישורי עבודה אינם נבדקים אוטומטית. יש לבדוק דרישות באתר המקור.</p>
    @if (career.active(); as active) {
      <p>
        גרסת קורות חיים: <bdi>{{ active.name }} · {{ active.id }}</bdi>
      </p>
      <p>
        עדות למונחים: <bdi>{{ resume().strengths.join(', ') || 'לא נמצאו מונחים משותפים' }}</bdi>
      </p>
      @for (evidence of resume().evidence; track evidence.skill) {
        <p>
          <bdi>{{ evidence.skill }}</bdi
          >: <q dir="auto">{{ evidence.text }}</q>
        </p>
      }
      <p>
        מידע חסר: <bdi>{{ resume().missing.join(', ') || 'אין מונחים נוספים במילון' }}</bdi
        >. חוסר עדות אינו היעדר ניסיון.
      </p>
    } @else {
      <a routerLink="/app/resumes">בדיקה ואישור קורות חיים לקבלת הסבר</a>
    }
    <p>
      שיטה: evidence-v3. מילון מונחים מוגבל בעברית ובאנגלית; סעיפים עם שלילה או אי־ודאות אינם נחשבים
      עדות חיובית; אזכור אינו הוכחת מומחיות. גרסת משרה:
      <bdi>{{ job().source?.version || 'מקור נוכחי' }}</bdi
      >.
    </p>
  </details>`,
})
export class MatchIndicator {
  readonly job = input.required<Job>();
  readonly store = inject(AppStore);
  readonly career = inject(CareerStore);
  readonly preference = computed(() => preferenceMatch(this.job(), this.store.preferences()));
  readonly resume = computed(() =>
    resumeMatch(this.job(), this.career.active()?.text ?? '', !!this.career.active()),
  );
  status(value: string) {
    return (
      {
        match: 'תואם',
        unknown: 'לא נמסר במקור',
        conflict: 'סותר דרישה',
        unspecified: 'לא הוגדרה דרישה',
      } as Record<string, string>
    )[value];
  }
}
