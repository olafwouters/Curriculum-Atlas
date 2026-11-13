export function readState(value) {
  const v = value;
  if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.programme !== 'string' || !v.programme.trim() || !Array.isArray(v.modules)) throw Error('Ongeldige werkruimte: opleidingsnaam en modules zijn verplicht.');
  const ids = new Set();
  for (const m of v.modules) {
    if (!m || typeof m.id !== 'string' || ids.has(m.id) || typeof m.name !== 'string' || !Array.isArray(m.courses)) throw Error('Ongeldige of dubbele module-identiteit.');
    ids.add(m.id);
    if (m.courses.some(c => !c || typeof c.code !== 'string' || !c.code)) throw Error('Ongeldige vakcode.');
  }
  if (v.mappings && (typeof v.mappings !== 'object' || Array.isArray(v.mappings))) throw Error('Ongeldige mappings.');
  return structuredClone(v);
}
export function mappingKey(mappings, outcome, module, code) {
  const base = outcome + '|' + module;
  if (code === undefined) return base;
  const canonical = base + '::' + encodeURIComponent(code), legacy = base + '|' + encodeURIComponent(code);
  if (Object.hasOwn(mappings, canonical) && Object.hasOwn(mappings, legacy)) throw Error('Twee mapping-sleutels voor hetzelfde deelvak. Exporteer en controleer de gegevens; niets is overschreven.');
  return Object.hasOwn(mappings, legacy) ? legacy : canonical;
}
export function normalise(a = {}) {
  return {...a, phase:a.phase || (['introduced','practised'].includes(a.status) ? a.status : ''), testing:a.testing || (a.status === 'assessed' ? 'summative' : 'unknown'), review:a.review || 'unreviewed', decision:a.decision || (['gap','excluded'].includes(a.status) ? a.status : 'included')};
}
export function legacyStatus(a) {
  return a.decision === 'gap' ? 'gap' : a.decision === 'excluded' ? 'excluded' : a.phase === 'mastery' ? 'practised' : a.phase || (a.testing === 'summative' ? 'assessed' : 'unreviewed');
}
