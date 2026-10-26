import { assessJob, eligibilityLabel } from '../core/job-assessment';
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
    <summary>
      {{
        assessment().skillsScore === null
          ? 'אין מספיק מידע למדד כישורים'
          : 'כיסוי מונחי כישורים: ' + assessment().skillsScore + '%'
      }}
      · {{ eligibilityLabel(assessment().eligibility) }}
    </summary>
    <p>
      כיסוי עדות למונחים שחולצו: {{ assessment().skillsCoverage.matched }} מתוך
      {{ assessment().skillsCoverage.required }}. זה אינו ציון כולל להתאמה או הסתברות לקבלה; דרישות
      שלא חולצו נשארות לבדיקה.
    </p>
    <p>
      שלמות נתוני המשרה: {{ assessment().completeness }}% · ביטחון בעדות:
      {{ assessment().confidence }} · מידע בר־השוואה: {{ assessment().knownWeight }}/100
    </p>
    <p>
      השכר, הגאוגרפיה ואישור העבודה נבדקים בנפרד. מידע חסר אינו מוסיף נקודות; אין חיזוי סיכויי קבלה.
    </p>
    @for (factor of assessment().dimensions; track factor.key) {
      <p>
        {{ factor.label }}:
        {{
          factor.known ? factor.points + ' / ' + factor.weight : 'לא ידוע · משקל ' + factor.weight
        }}
        — <bdi>{{ factor.evidence }}</bdi>
      </p>
    }
    @for (blocker of assessment().blockers; track blocker) {
      <p class="form-error">{{ blocker }}</p>
    }
    @for (question of assessment().questions; track question) {
      <p>{{ question }}</p>
    }
    @if (job().facts?.citizenshipCountry; as citizen) {
      <p dir="auto">דרישת אזרחות במקור: {{ citizen.quote }}</p>
    }
    @for (skill of job().facts?.requiredSkills ?? []; track $index) {
      <p dir="auto">דרישה: {{ skill.value }} — {{ skill.quote }}</p>
    }
    @for (skill of job().facts?.preferredSkills ?? []; track $index) {
      <p dir="auto">יתרון בלבד: {{ skill.value }} — {{ skill.quote }}</p>
    }
    <a routerLink="/app/profile">עדכון ואישור הפרטים לבדיקת התאמה</a>
    <p>
      גרסת החישוב: {{ assessment().method }} · מחושב מחדש לפי הפרופיל, ההעדפות וקורות החיים הפעילים.
      רעננות מוצגת בנפרד.
    </p>
    <p>{{ preference().label }} · {{ resume().label }}</p>
    <p>דרישות הסינון הן תנאי להצגה, בנפרד ממונחים בקורות החיים. אין חיזוי סיכויי קבלה.</p>
    @for (factor of preference().factors; track factor.label) {
      <p>{{ factor.label }}: {{ status(factor.status) }}</p>
    }
    @if (preference().excluded) {
      <p>המעסיק ברשימת ההחרגות.</p>
    }
    <p>
      ההשוואה משתמשת בפרטים שאישרת ובעדויות שחולצו מהמקור. יש לאמת את הדרישות ואת תנאי ההעסקה באתר
      המקור.
    </p>
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
      שיטה: {{ resume().method }}. מילון מונחים מוגבל בעברית ובאנגלית; סעיפים עם שלילה או אי־ודאות
      אינם נחשבים עדות חיובית; אזכור אינו הוכחת מומחיות. גרסת משרה:
      <bdi>{{ job().source?.version || 'מקור נוכחי' }}</bdi
      >.
    </p>
  </details>`,
})
export class MatchIndicator {
  readonly job = input.required<Job>();
  readonly eligibilityLabel = eligibilityLabel;
  readonly assessment = computed(() =>
    assessJob(
      this.job(),
      this.store.preferences(),
      this.career.active()?.text ?? '',
      !!this.career.active(),
      this.store.account().profile.criteria,
    ),
  );
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
