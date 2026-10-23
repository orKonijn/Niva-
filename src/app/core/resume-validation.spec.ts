import { describe, expect, it } from 'vitest';
import { validateResume } from './resume-validation';
describe('Client-side resume selection', () => {
  it('accepts PDF and DOCX without reading content', () => {
    expect(validateResume({ name: 'cv.PDF', type: 'application/pdf', size: 100 })).toBeNull();
    expect(
      validateResume({
        name: 'cv.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 100,
      }),
    ).toBeNull();
  });
  it('rejects unsupported extensions and mismatched MIME', () => {
    expect(validateResume({ name: 'cv.exe', type: '', size: 100 })).toBeTruthy();
    expect(validateResume({ name: 'cv.pdf', type: 'text/html', size: 100 })).toBeTruthy();
  });
  it('rejects empty and oversized files', () => {
    expect(validateResume({ name: 'cv.pdf', type: 'application/pdf', size: 0 })).toBeTruthy();
    expect(
      validateResume({ name: 'cv.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 }),
    ).toBeTruthy();
  });
  it('allows browsers with no MIME metadata, but still enforces size and extension', () => {
    expect(validateResume({ name: 'cv.pdf', type: '', size: 1024 })).toBeNull();
  });
});
