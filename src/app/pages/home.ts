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
      a: 'Niva נועדה לרכז את חיפוש העבודה, להציג משרות רלוונטיות ולאפשר בדיקה של כל מועמדות לפני שליחה. בגרסה הנוכחית אפשר להתנסות במסלול עם נתוני הדגמה בלבד.',
    },
    {
      q: 'האם נשלחות מועמדויות בלי האישור שלי?',
      a: 'לא. חוויית המוצר מבוססת על בדיקה ואישור מפורש לכל משרה. סביבת ההדגמה לא שולחת מועמדויות כלל ולא מתקשרת עם מעסיקים.',
    },
    {
      q: 'לאילו אתרי משרות אתם מחוברים?',
      a: 'הגרסה הזו כוללת משרות לדוגמה בלבד. חיבורים לאתרי משרות, אימות משתמשים ושירותי AI יתווספו לאחר פיתוח ובדיקת שירותי צד השרת.',
    },
    {
      q: 'מה קורה לקורות החיים שלי?',
      a: 'בהדגמה נבדקים רק סוג הקובץ והגודל במכשיר שלך. תוכן הקובץ אינו נקרא, מועלה או נשמר. גם שם הקובץ נשמר בזיכרון לביקור הנוכחי בלבד.',
    },
    {
      q: 'אפשר לעצור או לשנות העדפות?',
      a: 'כן. מתוך סביבת ההדגמה אפשר להשהות אישורים חדשים, לשנות תפקידים ומיקום, להחריג חברות ולאפס את הנתונים המקומיים בכל רגע.',
    },
  ];
}
