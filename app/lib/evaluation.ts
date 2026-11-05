export const CRITERIA = ['內容完整度', '需求符合度', '結構清晰度', '創意與洞察力', '語氣風格'] as const;
export interface Evaluation { criteria: { criterionName: string; scoreA: number; scoreB: number; justification: string }[]; summary: string; weaknessesA: string; weaknessesB: string }
export function parseEvaluation(raw: string): Evaluation {
  const data = JSON.parse(raw) as Evaluation;
  if (!data || !Array.isArray(data.criteria) || data.criteria.length !== CRITERIA.length) throw new Error('Invalid criteria');
  for (const name of CRITERIA) {
    const matches = data.criteria.filter(c => c.criterionName === name);
    if (matches.length !== 1) throw new Error('Missing or duplicate criterion');
    const c = matches[0];
    if (![c.scoreA, c.scoreB].every(s => typeof s === 'number' && Number.isFinite(s) && s >= 1 && s <= 10) || typeof c.justification !== 'string') throw new Error('Invalid score');
  }
  if (![data.summary, data.weaknessesA, data.weaknessesB].every(v => typeof v === 'string')) throw new Error('Invalid feedback');
  return data;
}
export function restoreOrder(data: Evaluation, swapped: boolean): Evaluation {
  if (!swapped) return data;
  const swap = (s: string) => s.replace(/Output A|Output B/g, v => v === 'Output A' ? 'Output B' : 'Output A');
  return { criteria: data.criteria.map(c => ({ ...c, scoreA: c.scoreB, scoreB: c.scoreA, justification: swap(c.justification) })), summary: swap(data.summary), weaknessesA: swap(data.weaknessesB), weaknessesB: swap(data.weaknessesA) };
}
