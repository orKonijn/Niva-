import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { Icon } from '../shared/icon';
import { CookiePreferences } from '../core/cookie-preferences';
import { AccountSession } from '../core/account-session';
import { AppStore } from '../core/app-store';
import { Reveal } from '../shared/reveal';
@Component({
  imports: [RouterLink, Brand, Icon, Reveal],
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
      a: 'המשרות מגיעות מלוחות רשמיים של מעסיקים בישראל באמצעות Greenhouse ו־Lever, עם שם המקור וקישור הגשה. הכיסוי מתרחב ואינו כולל את כל שוק העבודה.',
    },
    {
      q: 'מה קורה לקורות החיים שלי?',
      a: 'אפשר לבחור PDF/DOCX לקריאה בדפדפן או להדביק טקסט. בודקים את הטקסט לפני שמירתו בחשבון ל־30 יום; קובץ המקור אינו נשלח. עיבוד בצ׳אט על ידי OpenAI דורש הסכמה נפרדת. אפשר לייצא ולמחוק; לא שולחים למעסיק.',
    },
    {
      q: 'אפשר לעצור או לשנות העדפות?',
      a: 'כן. אפשר לשנות תחומים, מחוז וסגנונות עבודה, להחריג חברות ולנהל את הנתונים השמורים מתוך החשבון. Niva אינה מבצעת הגשות אוטומטיות.',
    },
  ];
}
