import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { Icon } from '../shared/icon';
import { CookiePreferences } from '../core/cookie-preferences';
@Component({
  imports: [RouterLink, Brand, Icon],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly cookies = inject(CookiePreferences);
  readonly menu = signal(false);
  readonly faqs = [
    {
      q: 'מה Niva עושה בשבילי?',
      a: 'Niva מרכזת חיפוש עבודה, העדפות ומשרות שמורות. הפיילוט מציג משרות ממקור מעסיק לצד מצב הדגמה נפרד. הגשה אמיתית מתבצעת באתר המקור בלבד.',
    },
    {
      q: 'האם נשלחות מועמדויות בלי האישור שלי?',
      a: 'לא. חוויית המוצר מבוססת על בדיקה ואישור מפורש לכל משרה. סביבת ההדגמה לא שולחת מועמדויות כלל ולא מתקשרת עם מעסיקים.',
    },
    {
      q: 'לאילו אתרי משרות אתם מחוברים?',
      a: 'הפיילוט טוען משרות AppsFlyer בהרצליה מה־API הציבורי של Greenhouse, עם מקור וקישור הגשה. זהו כיסוי מוגבל של מעסיק אחד. נתוני ההדגמה מופרדים ואין שירות AI.',
    },
    {
      q: 'מה קורה לקורות החיים שלי?',
      a: 'בהדגמה נבדקים רק סוג הקובץ והגודל במכשיר שלך. תוכן הקובץ אינו נקרא, מועלה או נשמר. גם שם הקובץ נשמר בזיכרון לביקור הנוכחי בלבד.',
    },
    {
      q: 'אפשר לעצור או לשנות העדפות?',
      a: 'כן. מתוך סביבת ההדגמה אפשר להשהות אישורים חדשים, לשנות תחומים, מחוז וסגנונות עבודה, להחריג חברות ולאפס את הנתונים המקומיים בכל רגע.',
    },
  ];
}
