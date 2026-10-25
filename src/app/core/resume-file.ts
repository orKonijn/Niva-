export const MAX_LOCAL_CV_BYTES = 10_000_000;
const textLimit = 30000;
const xmlLimit = 2_000_000;
export function checkedResumeText(text: string): string {
  const value = text.replace(/\u0000/g, '').trim();
  if (value.length < 20)
    throw new Error('לא נמצא מספיק טקסט. למסמך סרוק או מוגן יש להדביק את הטקסט ידנית.');
  if (value.length > textLimit)
    throw new Error('הטקסט ארוך מ־30,000 תווים. יש לבחור מסמך קצר יותר.');
  return value;
}
export async function readResumeFile(file: File): Promise<string> {
  if (!file.size || file.size > MAX_LOCAL_CV_BYTES) throw new Error('יש לבחור קובץ עד 10MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.pdf$/i.test(file.name) && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-') {
    const pdf = await import('pdfjs-dist');
    pdf.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs?v=' + pdf.version;
    const task = pdf.getDocument({
      data: bytes,
      useWasm: false,
      disableFontFace: true,
      useSystemFonts: true,
      stopAtErrors: true,
      cMapUrl: '/assets/pdfjs/cmaps/',
      standardFontDataUrl: '/assets/pdfjs/standard_fonts/',
      verbosity: 0,
    });
    const timer = setTimeout(() => void task.destroy(), 20000);
    try {
      const document = await task.promise;
      if (document.numPages > 20) throw new Error('אפשר לקרוא עד 20 עמודים.');
      let text = '';
      for (let page = 1; page <= document.numPages; page++) {
        const content = await (await document.getPage(page)).getTextContent();
        text +=
          content.items
            .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
            .join('') + '\n';
        if (text.length > textLimit) throw new Error('הטקסט ארוך מ־30,000 תווים.');
      }
      return checkedResumeText(text);
    } catch (error) {
      if (error instanceof Error && /עמודים|תווים|טקסט/.test(error.message)) throw error;
      throw new Error('לא ניתן לקרוא את ה־PDF. ייתכן שהוא סרוק, מוגן או פגום. אפשר להדביק טקסט.');
    } finally {
      clearTimeout(timer);
      await task.destroy();
    }
  }
  if (!/\.docx$/i.test(file.name) || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    throw new Error('יש לבחור קובץ PDF או DOCX תקין.');
  const { Unzip, UnzipInflate } = await import('fflate');
  let total = 0,
    entries = 0,
    main = false;
  const parts: string[] = [];
  const unzip = new Unzip((entry) => {
    if (++entries > 300) throw new Error('המסמך מורכב מדי. אפשר להדביק טקסט.');
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/.test(entry.name)) return;
    if ((entry.originalSize ?? 0) > xmlLimit) throw new Error('המסמך גדול מדי לפענוח.');
    const chunks: Uint8Array[] = [];
    entry.ondata = (error, data, final) => {
      if (error) throw new Error('קובץ ה־DOCX פגום.');
      total += data.length;
      if (total > xmlLimit) throw new Error('המסמך גדול מדי לפענוח.');
      chunks.push(data);
      if (!final) return;
      const joined = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.length;
      }
      const xml = new TextDecoder().decode(joined);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('המסמך מכיל מבנה שאינו נתמך.');
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      if (document.querySelector('parsererror')) throw new Error('קובץ ה־DOCX פגום.');
      const text = Array.from(document.getElementsByTagNameNS('*', 'p'))
        .map((paragraph) =>
          Array.from(paragraph.getElementsByTagNameNS('*', 't'))
            .map((node) => node.textContent)
            .join(''),
        )
        .join('\n');
      if (entry.name === 'word/document.xml') {
        main = true;
        parts.unshift(text);
      } else parts.push(text);
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let at = 0; at < bytes.length; at += 512)
      unzip.push(bytes.subarray(at, at + 512), at + 512 >= bytes.length);
  } catch {
    throw new Error('לא ניתן לקרוא את ה־DOCX בבטחה. אפשר להדביק את הטקסט ידנית.');
  }
  if (!main) throw new Error('הקובץ אינו מסמך DOCX תקין.');
  return checkedResumeText(parts.join('\n'));
}
