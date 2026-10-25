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
      a: 'Niva מציגה משרות מאתרי מעסיקים בישראל, מסננת אותן לפי ההעדפות שלך ומאפשרת לשמור את מה שמעניין. להגשת מועמדות עוברים לאתר המעסיק.',
    },
    {
      q: 'האם נשלחות מועמדויות בלי האישור שלי?',
      a: 'לא. Niva לא מגישה מועמדות ולא שולחת קורות חיים למעסיקים. אם משרה מעניינת אותך, אפשר לפתוח את אתר המעסיק ולהגיש שם בעצמך.',
    },
    {
      q: 'לאילו אתרי משרות אתם מחוברים?',
      a: 'המשרות מגיעות מאתרי הגיוס של מעסיקים בישראל שמשתמשים ב־Greenhouse וב־Lever. לכל משרה מצורף קישור לאתר שבו פורסמה. Niva עדיין לא מציגה את כל המשרות בשוק.',
    },
    {
      q: 'מה קורה לקורות החיים שלי?',
      a: 'אפשר לבחור קובץ PDF או DOCX, או להדביק את הטקסט. הקובץ נקרא במכשיר שלך, והטקסט מוצג לבדיקה לפני שמירתו בחשבון ל־30 יום. קובץ המקור לא נשלח לשרת. אפשר להוריד את הטקסט או למחוק אותו. צירוף קורות החיים לשיחה עם OpenAI דורש אישור נפרד; הם לא נשלחים למעסיקים.',
    },
    {
      q: 'אפשר לשנות את ההעדפות בהמשך?',
      a: 'כן. אפשר לעדכן תחום, מחוז ואופן עבודה, להסתיר חברות מסוימות ולשנות את רשימת המשרות ששמרת. השינויים נעשים מתוך החשבון שלך. Niva לא מגישה מועמדות באופן אוטומטי.',
    },
  ];
}
