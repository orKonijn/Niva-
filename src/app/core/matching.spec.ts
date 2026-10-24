import { describe, expect, it } from 'vitest';
import { preferenceMatch, resumeMatch, skillEvidence, tailorExtractive } from './matching';
import { JOBS } from './data/sample-jobs';
import { defaultPreferences } from './preferences';
const job = {
  ...JOBS[0],
  title: 'QA Automation Engineer',
  description: 'Python SQL test automation Playwright',
  skills: [],
};
describe('evidence matching', () => {
  it('recognizes Hebrew/English synonyms and separates manual QA, QA automation and business automation', () => {
    expect(skillEvidence('אנגולר ופייתון עם שאילתות')).toEqual(
      expect.arrayContaining(['Angular', 'Python', 'SQL']),
    );
    expect(skillEvidence('Manual QA experience')).not.toContain('QA Automation');
    expect(skillEvidence('n8n workflow automation')).toEqual(['Workflow Automation']);
    expect(skillEvidence('QA Automation Engineer')).toContain('QA Automation');
    expect(skillEvidence('No Python experience')).not.toContain('Python');
    expect(skillEvidence('ללא ניסיון ב־Python')).not.toContain('Python');
  });
  it('does not score unconfirmed, incomplete resumes, or call missing evidence lack of experience', () => {
    expect(resumeMatch(job, 'Python', false).coverage).toBeNull();
    expect(
      resumeMatch({ ...job, description: '', title: 'Unspecified role' }, 'Python', true).coverage,
    ).toBeNull();
    const score = resumeMatch(job, 'פייתון ו־SQL', true);
    expect(score.strengths).toEqual(['Python', 'SQL']);
    expect(score.missing).toContain('QA Automation');
    expect(score.coverage).toBeCloseTo(2 / 3);
  });
  it('honors hard employer exclusions and conflicting district/work-style requirements', () => {
    const p = { ...defaultPreferences(), exclusions: job.company };
    expect(preferenceMatch(job, p).eligible).toBe(false);
    expect(
      preferenceMatch(
        { ...job, workStyle: 'unknown' },
        { ...defaultPreferences(), workStyles: ['remote'] },
      ).factors[2]?.status,
    ).toBe('unknown');
  });
  it('keeps employers and dates together and never adds facts during extractive tailoring', () => {
    const original = 'Candidate\n\nEmployer A\nManual QA, 2020\n\nEmployer B\nPython SQL, 2023';
    const result = tailorExtractive(original, job);
    expect(result.text.split('\n\n').sort()).toEqual(original.split('\n\n').sort());
    expect(result.text).toContain('Employer B\nPython SQL, 2023');
  });
});
