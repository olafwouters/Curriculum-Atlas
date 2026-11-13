const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function readState(value) {
  if (!record(value) || typeof value.programme !== 'string' || !value.programme.trim() || !Array.isArray(value.modules)) throw Error('Ongeldige werkruimte: opleidingsnaam en modules zijn verplicht.');
  const v = structuredClone(value), ids = new Set();
  if ((v.mappings != null && !record(v.mappings)) || (v.targets != null && !record(v.targets))) throw Error('Ongeldige mappings of doelniveaus.');
  for (const m of v.modules) {
    if (!record(m) || typeof m.id !== 'string' || !m.id || ids.has(m.id) || typeof m.name !== 'string') throw Error('Ongeldige of dubbele module-identiteit.');
    ids.add(m.id); m.courses ??= [];
    if (!Array.isArray(m.courses) || m.courses.some(c => !record(c) || typeof c.code !== 'string' || !c.code)) throw Error('Ongeldige deelvakken of vakcode.');
  }
  return v;
}
export function mappingKey(mappings, outcome, module, code) {
  const base = outcome + '|' + module;
  if (code === undefined) return base;
  const canonical = base + '::' + encodeURIComponent(code), legacy = base + '|' + encodeURIComponent(code);
  if (Object.hasOwn(mappings, canonical) && Object.hasOwn(mappings, legacy)) throw Error('Twee mapping-sleutels voor hetzelfde deelvak. Exporteer en controleer de gegevens; niets is overschreven.');
  return Object.hasOwn(mappings, legacy) ? legacy : canonical;
}
export function parseMappingKey(key) {
  if (typeof key !== 'string') throw Error('Ongeldige mapping-sleutel.');
  const first = key.indexOf('|');
  if (first < 1) throw Error('Ongeldige mapping-sleutel.');
  const outcome = key.slice(0, first), entity = key.slice(first + 1);
  const canonical = entity.indexOf('::'), legacy = entity.indexOf('|');
  if (canonical >= 0 && legacy >= 0) throw Error('Gemengde mapping-sleutel.');
  const split = canonical >= 0 ? canonical : legacy;
  const module = split < 0 ? entity : entity.slice(0, split);
  if (!module) throw Error('Module-ID ontbreekt.');
  if (split < 0) return {outcome, module, code:undefined};
  const encoded = entity.slice(split + (canonical >= 0 ? 2 : 1));
  if (!encoded || encoded.includes('|') || encoded.includes('::')) throw Error('Ongeldige deelvaksleutel.');
  try {return {outcome, module, code:decodeURIComponent(encoded)};} catch {throw Error('Ongeldige codering in deelvaksleutel.');}
}
export function normalise(value) {
  const a = value ?? {};
  if (!record(a)) throw Error('Ongeldige mappinggegevens.');
  return {...a, phase:a.phase || (['introduced','practised'].includes(a.status) ? a.status : ''), testing:a.testing || (a.status === 'assessed' ? 'summative' : 'unknown'), review:a.review || 'unreviewed', decision:a.decision || (['gap','excluded'].includes(a.status) ? a.status : 'included')};
}
export function legacyStatus(a) {
  return a.decision === 'gap' ? 'gap' : a.decision === 'excluded' ? 'excluded' : a.phase === 'mastery' ? 'practised' : a.phase || (a.testing === 'summative' ? 'assessed' : 'unreviewed');
}
export function applyMapping(state, key, fields) {
  if (!record(fields)) throw Error('Ongeldige mappinggegevens.');
  const next = readState(state), parsed = parseMappingKey(key);
  const module = next.modules.find(m => m.id === parsed.module);
  if (!module || (parsed.code !== undefined && !module.courses.some(c => c.code === parsed.code))) throw Error('Module of deelvak niet gevonden; mapping niet gewijzigd.');
  next.mappings ??= {};
  const resolved = mappingKey(next.mappings, parsed.outcome, parsed.module, parsed.code);
  const a = {...normalise(next.mappings[resolved]), ...structuredClone(fields)};
  if (a.testing === 'elsewhere' && !next.modules.some(m => m.id === a.elsewhere && m.id !== module.id)) throw Error('Kies een andere beoordelingsmodule.');
  next.mappings[resolved] = {...a, status:legacyStatus(a)};
  next.schemaVersion = 6;
  return next;
}
