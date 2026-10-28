import type { Job } from '../src/app/core/models/job';
import type { ResumeVersion } from '../src/app/core/models/career';
import { resumeMatch } from '../src/app/core/matching';

export type GuideIntent = 'search' | 'requirements' | 'interview' | 'resume' | 'help';
/** Explicit, bounded guide actions, not a language model or a qualification decision. */
export function guideIntent(message: string, action?: unknown): GuideIntent {
  if (['search', 'requirements', 'interview', 'resume', 'help'].includes(String(action)))
    return action as GuideIntent;
  if (/ריאיון|ראיון|interview/i.test(message)) return 'interview';
  if (/קורות חיים|résumé|resume|\bcv\b/i.test(message)) return 'resume';
  if (/דרישות|requirements|eligib|זכאות|התאמה/i.test(message)) return 'requirements';
  if (/חפש|חיפוש|מצא|מצאי|משרות|jobs?|search|find/i.test(message)) return 'search';
  return 'help';
}
export function guideQuery(message: string, search?: unknown) {
  if (typeof search === 'string') return search.trim().slice(0, 160);
  // Free text is used as a literal search after a small set of clear command prefixes.
  // Never silently reinterpret location, salary or authorization as confirmed profile facts.
  return message
    .replace(/^(?:חפשי?|מצאי?|תמצאי|עזרי לי למצוא|search(?: for)?|find(?: me)?)\s+/i, '')
    .replace(/^(?:משרות|עבודה|jobs?)(?:\s+(?:של|for))?(?:\s+|$)/i, '')
    .trim()
    .slice(0, 160);
}
export function guideReply(input: {
  intent: GuideIntent;
  query: string;
  jobs: Job[];
  selected?: Job;
  total: number;
  resume?: ResumeVersion;
  selectedConflict?: boolean;
}) {
  const { intent, query, jobs, selected, total, resume } = input;
  const heading = 'מדריך Niva המובנה · מידע מהמאגר וכללי הדרכה, ללא בינה מלאכותית.\n\n';
  const reference = (job: Job) => `${job.title} — ${job.company} [job:${job.id}]`;
  const caveat =
    '\n\nיש לבדוק את התנאים והזמינות באתר המעסיק. עבודה מרחוק אינה מבטיחה זכאות מכל מדינה; המידע כאן אינו אישור התאמה או זכות עבודה.';
  if (intent === 'search') {
    if (!jobs.length)
      return (
        heading +
        `לא נמצאו משרות${query ? ` בחיפוש המדויק ״${query}״` : ''} במסגרת ההעדפות שלך. אפשר לקצר את שם התפקיד, לנסות שם חלופי או לעדכן את ההעדפות במסך החיפוש. לא הרחבתי את התנאים ללא בחירתך.`
      );
    return (
      heading +
      `נמצאו ${total} תוצאות${query ? ` לחיפוש ״${query}״` : ''} לפי העדפות החיפוש שלך. אלה ${jobs.length} התוצאות הראשונות בדירוג Niva, ולא רשימה מלאה של שוק העבודה:\n\n` +
      jobs
        .map(
          (job, i) =>
            `${i + 1}. ${reference(job)}\nמיקום במקור: ${job.source?.location || 'לא נמסר'}. ${job.facts?.opportunity ? 'מאגר מועמדים, לא משרה פתוחה מאומתת.' : 'יש לבדוק את סטטוס הפרסום בדף המשרה.'}`,
        )
        .join('\n\n') +
      caveat
    );
  }
  if (intent === 'help')
    return (
      heading +
      'אפשר לחפש תפקיד, לבדוק דרישות של משרה, להכין שאלות לריאיון או לבדוק עדויות בקורות חיים. בחרי פעולה מהכרטיסים, או כתבי למשל: ״חפשי QA״. לשיחה חופשית בעברית או באנגלית נדרש חיבור שירות AI; הוא אינו מופעל במצב המובנה.'
    );
  if (!selected)
    return (
      heading +
      'כדי לעבוד על משרה מסוימת, יש לפתוח משרה מתוצאות החיפוש ולבחור ״שיחה והכנה לריאיון״. כך ההדרכה מתייחסת למקור הנכון. אפשר להתחיל כאן בחיפוש תפקיד.'
    );
  const facts = selected.facts;
  const context =
    reference(selected) +
    (input.selectedConflict
      ? '\nשימי לב: המשרה הזו אינה עומדת בכל העדפות החיפוש השמורות שלך. היא מוצגת לבדיקה בלבד.'
      : '');
  if (intent === 'requirements') {
    const required = [
      ...(facts?.requiredSkills?.map((s) => s.value) ?? []),
      ...(facts?.requiredSkillAlternatives?.map((s) => s.value.join(' / ')) ?? []),
    ];
    const conditions = [
      ...(facts?.locationConditions?.map((s) => s.value) ?? []),
      facts?.authorizationCondition?.value,
      facts?.authorizationCountry ? `זכות עבודה: ${facts.authorizationCountry.value}` : null,
      facts?.citizenshipCountry ? `תנאי אזרחות: ${facts.citizenshipCountry.value}` : null,
      facts?.applicantCountries?.value.join(', '),
      facts?.applicantRegions?.value.join(', '),
    ].filter(Boolean);
    return (
      heading +
      context +
      '\n\nדרישות שחולצו מהמקור: ' +
      (required.length
        ? required.join(', ')
        : 'לא חולצו דרישות מיומנות ברורות; יש לקרוא את התיאור המקורי.') +
      '\nניסיון מינימלי: ' +
      (facts?.minimumYears ? `${facts.minimumYears.value} שנים לפי המקור.` : 'לא זוהה בוודאות.') +
      '\nתנאי מיקום וזכאות שנמצאו: ' +
      (conditions.join('; ') || 'לא חולצו תנאים מפורשים; אין בכך אישור זכאות.') +
      (facts?.requirementsUnresolved
        ? '\nחלק מהדרישות לא ניתנות להשוואה ודאית. יש לבדוק את ההקשר בתיאור המקורי.'
        : '') +
      caveat
    );
  }
  if (intent === 'resume') {
    if (!resume)
      return (
        heading +
        context +
        '\n\nלא צורפה גרסה פעילה ומאושרת. אפשר להכין ולאשר גרסה במסך קורות החיים, ואז לבחור כאן לצרף אותה. לא ניחשתי ניסיון או מיומנויות.'
      );
    const match = resumeMatch(selected, resume.text, true);
    return (
      heading +
      context +
      `\n\n${match.label}. זהו חיפוש עדויות למונחים, לא ציון סיכוי להתקבל.\nעדויות שנמצאו: ${match.strengths.join(', ') || 'לא נמצאו עדויות ברורות'}.\nדרישות ללא עדות בטקסט: ${match.missing.join(', ') || 'אין דרישות נוספות שניתנות להשוואה'}.\nאפשר להוסיף דוגמה אמיתית לכל מיומנות רלוונטית במסך קורות החיים. אין להוסיף ניסיון שלא היה.` +
      caveat
    );
  }
  return (
    heading +
    context +
    '\n\nתרגול מובנה לריאיון — אלה שאלות הכנה כלליות, לא שאלות שנמסרו מהמעסיק:\n1. איזה ניסיון אמיתי שלך קשור לאחריות שמתוארת במשרה?\n2. בחרי דרישה מהתיאור והציגי דוגמה: מצב, משימה, פעולה ותוצאה.\n3. איך היית מתמודדת עם בעיה שלא פתרת בעבר, ואיך היית בודקת את הפתרון?\n4. אילו תנאי מיקום, עבודה וזכאות צריך לברר עם המעסיק?\n\nעני לעצמך או שמרי טיוטה פרטית. המדריך אינו בודק או מדרג תשובות חופשיות. אפשר לפתוח את דף המשרה דרך הקישור למטה.'
  );
}
