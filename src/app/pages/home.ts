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
      a: 'כעת מוצגות משרות AppsFlyer בהרצליה דרך Greenhouse, עם מקור וקישור הגשה. הכיסוי מוגבל למעסיק הזה; אין הבטחה לכיסוי כל שוק העבודה.',
    },
    {
      q: 'מה קורה לקורות החיים שלי?',
      a: 'בחירת קובץ בודקת רק את הסוג והגודל במכשיר שלך. תוכן הקובץ אינו נקרא, מועלה או נשמר. גם שם הקובץ נשמר בזיכרון לביקור הנוכחי בלבד.',
    },
    {
      q: 'אפשר לעצור או לשנות העדפות?',
      a: 'כן. אפשר לשנות תחומים, מחוז וסגנונות עבודה, להחריג חברות ולנהל את הנתונים השמורים מתוך החשבון. Niva אינה מבצעת הגשות אוטומטיות.',
    },
  ];
}
