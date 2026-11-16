import {mappingKey,normalise,applyMapping} from './domain.mjs';

export function groupOutcomes(outcomes) {
  const groups = new Map(), ids = new Set();
  for (const o of outcomes) {
    if (ids.has(o.id)) throw Error('Dubbele leeruitkomst-ID.');
    ids.add(o.id);
    if (!groups.has(o.domain)) groups.set(o.domain,{domain:o.domain,color:o.color,outcomes:[]});
    groups.get(o.domain).outcomes.push(o);
  }
  return [...groups.values()];
}

export function mappingSummary(mappings, outcomes, module, code) {
  let count = 0, ambiguous = false;
  for (const o of outcomes) {
    try {
      const key = mappingKey(mappings ?? {},o.id,module,code);
      if (Object.hasOwn(mappings ?? {},key)) count++;
    } catch {ambiguous = true;}
  }
  return {count,ambiguous};
}

export function createLevelDrafts(state, outcomes, module, code) {
  return Object.fromEntries(outcomes.map(o => {
    const key = mappingKey(state.mappings ?? {},o.id,module,code);
    return [o.id,{key,level:o.level,exists:Object.hasOwn(state.mappings ?? {},key),value:normalise(structuredClone(state.mappings?.[key]))}];
  }));
}

export function updateLevelDraft(drafts, id, field, value) {
  if (!Object.hasOwn(drafts,id)) throw Error('Leeruitkomst niet gevonden.');
  return {...drafts,[id]:{...drafts[id],value:{...drafts[id].value,[field]:value}}};
}

export function applyLevelDrafts(state, drafts, changed) {
  let next = structuredClone(state);
  for (const id of changed) {
    if (!Object.hasOwn(drafts,id)) throw Error('Leeruitkomst niet gevonden.');
    const draft = drafts[id];
    try {next = applyMapping(next,draft.key,draft.value);}
    catch (error) {throw Error(draft.level+': '+(error instanceof Error ? error.message : String(error)));}
  }
  return next;
}
