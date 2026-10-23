export function validateResume(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['pdf', 'docx'].includes(ext)) return 'אפשר לבחור קובץ PDF או DOCX בלבד.';
  const mime =
    ext === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (file.type && file.type !== mime) return 'סוג הקובץ לא תואם לסיומת. נסו קובץ PDF או DOCX אחר.';
  if (file.size === 0) return 'הקובץ ריק. בחרו קובץ אחר.';
  if (file.size > 10 * 1024 * 1024) return 'הקובץ גדול מ־10MB. בחרו קובץ קטן יותר.';
  return null;
}
