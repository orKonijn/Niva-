import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { Icon } from '../shared/icon';
import { CookiePreferences } from '../core/cookie-preferences';
import { AccountSession } from '../core/account-session';
import { AppStore } from '../core/app-store';
@Component({
  imports: [RouterLink, Brand, Icon],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly session = inject(AccountSession);
  readonly store = inject(AppStore);
  readonly cookies = inject(CookiePreferences);
  readonly menu = signal(false);
  readonly faqs = [
    {
      q: 'מה Niva עושה בשבילי?',
      a: 'Niva מרכזת משרות ממקור מעסיק, העדפות ומשרות שמורות בחשבון שלך. הגשת מועמדות מתבצעת באתר המקור בלבד.',
    },
    {
      q: 'האם נשלחות מועמדויות בלי האישור שלי?',
      a: 'לא. Niva אינה שולחת מועמדויות או קבצים למעסיקים. פותחים את המשרה ובוחרים אם להגיש ישירות באתר המקור.',
    },
    {
      q: 'לאילו אתרי משרות אתם מחוברים?',
      a: 'כעת מקורות הנתונים הם AppsFlyer / Greenhouse ו־WalkMe / Lever בישראל, עם מקור וקישור הגשה. הכיסוי מוגבל למעסיקים אלה; אין הבטחה לכיסוי כל שוק העבודה.',
    },
    {
      q: 'מה קורה לקורות החיים שלי?',
      a: 'במרחב קורות החיים ניתן לשמור טקסט וגרסאות בחשבון ל־30 יום. העלאת PDF/DOCX דורשת שירות סריקה ופענוח מוגדר והסכמה להעברה אליו. עיבוד בצ׳אט על ידי OpenAI דורש הסכמה נפרדת. אפשר לייצא ולמחוק; לא שולחים למעסיק.',
    },
    {
      q: 'אפשר לעצור או לשנות העדפות?',
      a: 'כן. אפשר לשנות תחומים, מחוז וסגנונות עבודה, להחריג חברות ולנהל את הנתונים השמורים מתוך החשבון. Niva אינה מבצעת הגשות אוטומטיות.',
    },
  ];
}
