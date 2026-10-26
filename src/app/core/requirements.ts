/** Section scope is retained across bullets until the next heading. */
export function requirementClauses(text: string) {
  type Scope = 'required' | 'preferred' | 'responsibilities' | 'other';
  const result = {
    required: [] as string[],
    preferred: [] as string[],
    responsibilities: [] as string[],
  };
  let scope: Scope = 'other';
  const requiredHeader =
    /^(?:requirements|qualifications|what (?:we(?:'|’)re looking for|we are looking for|you(?:'|’)ll (?:bring|need)|you bring)|who you are|your (?:experience|qualifications)|דרישות(?: התפקיד)?|מה נדרש)(?:\s*[:：])?$/i;
  const preferredHeader =
    /^(?:bonus(?: points)?|nice.to.haves?|preferred(?: qualifications)?|advantages?|יתרונות|יתרון)(?:\s*[:：])?$/i;
  const responsibilitiesHeader =
    /^(?:responsibilities|what you(?:'|’)ll do|what you will do|your (?:role|impact)|the role|role description|תיאור התפקיד|תחומי אחריות)(?:\s*[:：])?$/i;
  const otherHeader =
    /^(?:benefits|about .+|what (?:we offer|you get)|compensation|equal opportunity.*|why .+)(?:\s*[:：])?$/i;
  const prepared = text.replace(
    /\b(Requirements|Qualifications|Bonus Points|What we are looking for|What you'll do|Benefits)\s*:/gi,
    '\n$1:\n',
  );
  for (const raw of prepared.split('\n')) {
    const line = raw.replace(/^\s*[•*\-–]\s*/, '').trim();
    if (!line) continue;
    if (requiredHeader.test(line)) {
      scope = 'required';
      continue;
    }
    if (preferredHeader.test(line)) {
      scope = 'preferred';
      continue;
    }
    if (responsibilitiesHeader.test(line)) {
      scope = 'responsibilities';
      continue;
    }
    if (line.length < 120 && otherHeader.test(line)) {
      scope = 'other';
      continue;
    }
    const protectedLine = line.replace(/\be\.g\./gi, 'e_g_').replace(/\bi\.e\./gi, 'i_e_');
    for (const piece of protectedLine.split(/[;!?]|\.(?=\s+[A-Zא-ת])/)) {
      const clause = piece.replace(/e_g_/g, 'e.g.').replace(/i_e_/g, 'i.e.');
      if (!clause.trim()) continue;
      const optional =
        /preferred|bonus|advantage|nice.to.have|a plus|not required|helpful|יתרון/i.test(clause);
      const collaborator =
        /(?:work|collaborat\w*|partner|liais\w*|coordinate)\s+(?:closely\s+)?with\b|עבודה עם|שיתוף פעולה עם/i.test(
          clause,
        );
      if (collaborator || scope === 'responsibilities') {
        result.responsibilities.push(clause.trim());
        continue;
      }
      if (optional || scope === 'preferred') result.preferred.push(clause.trim());
      else if (
        scope === 'required' ||
        /\b(?:must (?:have|be|demonstrate)|required|proficien\w*|experience (?:with|in)|knowledge of|familiarity with|basic understanding of)\b|נדרש|חובה/i.test(
          clause,
        )
      )
        result.required.push(clause.trim());
    }
  }
  return result;
}
