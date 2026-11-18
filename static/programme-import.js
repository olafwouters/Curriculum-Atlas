/* Targeted programme imports and workspace-owned course information. */
(() => {
  'use strict';
  const tx = (nl, en) => localStorage.getItem('compass-language') === 'en' ? en : nl;
  const q = selector => document.querySelector(selector);
  const validCourse = path => /^\/(nl|en)\/course\/20\d{2}\/[A-Za-z0-9_-]+$/i.test(path || '');
  let sequence = 0;
  async function post(path, data, signal) {
    const response = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data), signal});
    const payload = await response.json();
    if (!response.ok) {const error = Error(payload.error || tx('Verzoek mislukt.', 'Request failed.')); error.payload = payload; error.status = response.status; throw error;}
    return payload;
  }
  const pathsFor = programme => [...new Set(programme.modules.flatMap(module => module.courses.map(course => course.path)))];
  function structureHTML(programme) {
    return '<h3>' + E(programme.programme) + '</h3><p>' + E(programme.edition) + '</p>' + programme.modules.map(module =>
      '<section><h4>' + tx('Jaar ', 'Year ') + E(module.year) + ' · ' + E(module.name) + ' · ' + E(module.ects || '') + ' ECTS</h4><ul>' + module.courses.map(course => '<li>' + E(course.code) + ' — ' + E(course.name || '') + ' (' + E(course.ects || '') + ' ECTS)</li>').join('') + '</ul></section>').join('');
  }
  preview = async function(path) {
    if (q('#dialog')?.open) {say(tx('Sluit eerst het huidige venster.', 'Close the current dialog first.')); return;}
    const token = ++sequence, controller = new AbortController();
    let saved, online = null, comparison = null, working = false, details = {};
    const current = () => token === sequence && !controller.signal.aborted && q('#dialog')?.open;
    try {saved = await post('/api/programme', {path}, controller.signal);} catch (error) {say(error.message); return;}
    if (token !== sequence) return;
    const result = results.find(item => item.path === path);
    if (result) for (const key of ['cluster', 'mode', 'level', 'language']) saved[key] = result[key] || saved[key] || '';
    function buttons(disabled) {q('#body')?.querySelectorAll('[data-programme-action]').forEach(button => button.disabled = disabled);}
    function status(text) {const node = q('#programme-import-status'); if (node) node.textContent = text;}
    async function finish(source, allowIncomplete = false) {
      if (!current()) return;
      const programme = source === 'online' ? online : saved;
      let prepared;
      try {prepared = await post('/api/programme/prepare-import', {programme, details, source, allowIncomplete}, controller.signal);}
      catch (error) {
        if (!current()) return;
        if (error.payload?.missing && confirm(tx('Voor ', 'For ') + error.payload.missing.length + tx(' vakken ontbreken details. Onvolledig importeren?', ' courses, details are missing. Import incomplete?'))) return finish(source, true);
        throw error;
      }
      if (!current() || !canSwitch()) return;
      const workspace = prepared.state;
      ++sequence;
      q('#dialog').close();
      install(workspace);
      say(tx('Werkruimte aangemaakt; controleer de opslagstatus.', 'Workspace created; check the save status.'));
    }
    async function importVersion(source) {
      if (working || !canSwitch()) return;
      working = true; buttons(true);
      try {
        if (source === 'online') {
          const paths = pathsFor(online);
          for (const coursePath of paths.filter(path => !Object.hasOwn(details, path))) {
            if (!current()) return;
            status(tx('Vakdetails ophalen: ', 'Retrieving course details: ') + Object.keys(details).length + ' / ' + paths.length);
            try {const response = await post('/api/programme/course-details', {programme: online, path: coursePath, source: 'online'}, controller.signal); details[coursePath] = response.detail;}
            catch (error) {if (!current()) return; if (error.status === 401 || error.status === 403) throw error; status(error.message);}
          }
          if (!current()) return;
          const missing = paths.filter(path => !Object.hasOwn(details, path));
          if (missing.length) {
            status(tx('Ontbrekende vakdetails: ', 'Missing course details: ') + missing.length + tx('. Probeer opnieuw of importeer expliciet onvolledig.', '. Retry or explicitly import incomplete.'));
            q('#programme-import-incomplete').hidden = false;
            q('#programme-import-online').textContent = tx('Mislukte vakken opnieuw proberen', 'Retry failed courses');
            return;
          }
        }
        await finish(source);
      } catch (error) {if (current()) status(error.message);}
      finally {working = false; if (current()) buttons(false);}
    }
    function draw() {
      let summary = '';
      if (comparison) summary = '<p>' + (comparison.changed ? tx('Wijzigingen gevonden. Vergelijk de structuren hieronder, inclusief namen, studiepunten en volgorde.', 'Changes found. Compare the structures below, including names, credits and order.') : tx('Geen wijzigingen in de curriculumstructuur.', 'No curriculum-structure changes.')) + '</p><p>' + tx('Modules toegevoegd/verwijderd: ', 'Modules added/removed: ') + comparison.modulesAdded.length + '/' + comparison.modulesRemoved.length + ' · ' + tx('Vakverwijzingen toegevoegd/verwijderd: ', 'Course references added/removed: ') + comparison.courseReferencesAdded.length + '/' + comparison.courseReferencesRemoved.length + '</p>';
      dialog(tx('Curriculum controleren', 'Review curriculum'), '<div data-no-translate><p>' + tx('Import maakt een nieuwe werkruimte. Bestaande werkruimtes en mappings blijven ongewijzigd.', 'Import creates a new workspace. Existing workspaces and mappings remain unchanged.') + '</p>' + summary + '<div class="scroll"><details open><summary>' + tx('Opgeslagen versie', 'Saved version') + ' · ' + E(saved.fetched || '') + '</summary>' + structureHTML(saved) + '</details>' + (online ? '<details open><summary>' + tx('Online versie', 'Online version') + ' · ' + E(online.fetched || '') + '</summary>' + structureHTML(online) + '</details>' : '') + '</div><p id="programme-import-status" role="status" aria-live="polite"></p><div class="filters"><button type="button" class="primary" id="programme-import-saved" data-programme-action>' + tx('Importeer opgeslagen versie', 'Import saved version') + '</button><button type="button" id="programme-check-online" data-programme-action>' + tx('Zoek curriculum online', 'Search Curriculum Online') + '</button>' + (online ? '<button type="button" class="primary" id="programme-import-online" data-programme-action>' + tx('Importeer online versie', 'Import online version') + '</button><button type="button" id="programme-import-incomplete" data-programme-action hidden>' + tx('Importeer online versie onvolledig', 'Import online version incomplete') + '</button>' : '') + '<button type="button" id="programme-import-cancel">' + tx('Annuleren', 'Cancel') + '</button></div></div>');
      q('#programme-import-saved').onclick = () => importVersion('saved');
      q('#programme-import-cancel').onclick = () => q('#dialog').close();
      q('#programme-check-online').onclick = async () => {
        if (working) return;
        working = true; buttons(true); status(tx('Geselecteerde curriculumstructuur ophalen…', 'Retrieving selected curriculum structure…'));
        try {
          const response = await post('/api/programme/compare', {path}, controller.signal);
          if (!current()) return;
          saved = response.saved; online = response.online; comparison = response.comparison; details = {};
          working = false; draw();
        } catch (error) {if (current()) status(error.message);}
        finally {working = false; if (current()) buttons(false);}
      };
      if (online) {
        q('#programme-import-online').onclick = () => importVersion('online');
        q('#programme-import-incomplete').onclick = async () => {
          if (working || !confirm(tx('Importeren met ontbrekende vakdetails?', 'Import with missing course details?'))) return;
          working = true; buttons(true);
          try {await finish('online', true);} catch (error) {if (current()) status(error.message);} finally {working = false; if (current()) buttons(false);}
        };
      }
    }
    draw();
    q('#dialog').addEventListener('close', () => {controller.abort(); if (sequence === token) ++sequence;}, {once: true});
  };

  async function workspaceCourse(path) {
    if (!validCourse(path)) {say(tx('Geen geldige catalogusverwijzing voor dit vak.', 'No valid catalogue reference for this course.')); return;}
    const owner = state;
    let detail, provenance;
    if (owner && Object.hasOwn(owner, 'courseDetails')) {
      detail = owner.courseDetails?.[path];
      provenance = tx('Opgeslagen bij deze werkruimte', 'Saved with this workspace');
      if (!detail) {dialog(tx('Vakdetails ontbreken', 'Course details unavailable'), '<p>' + tx('Dit vak heeft geen details in de werkruimtekopie. Er wordt niet stilzwijgend een andere versie geladen.', 'This course has no details in the workspace snapshot. A different version is not loaded silently.') + '</p><a href="https://catalogue.hanze.nl' + E(path) + '" target="_blank" rel="noopener">' + tx('Open catalogusbron', 'Open catalogue source') + '</a>'); return;}
    } else {
      try {detail = await post('/api/course', {path});} catch (error) {say(error.message); return;}
      if (state !== owner) return;
      provenance = tx('Gedeelde opgeslagen catalogus; oudere werkruimte zonder eigen vakdetails', 'Shared saved catalogue; older workspace without embedded course details');
    }
    const metadata = detail.metadata || {};
    dialog(metadata.Name || metadata.Naam || path.split('/').pop(), '<div data-no-translate><p>' + E(provenance) + ' · ' + E(detail.fetched || '') + '</p><p>' + E(Object.entries(metadata).map(([key, value]) => key + ': ' + value).join(' · ')) + '</p><h3>' + tx('Leeruitkomsten', 'Learning outcomes') + '</h3><div class="source">' + E(detail.outcomes || tx('Niet vermeld in de bron.', 'Not provided by the source.')) + '</div><h3>' + tx('Inhoud', 'Content') + '</h3><div class="source">' + E(detail.content || tx('Niet vermeld in de bron.', 'Not provided by the source.')) + '</div><a href="https://catalogue.hanze.nl' + E(path) + '" target="_blank" rel="noopener">' + tx('Open catalogusbron', 'Open catalogue source') + '</a></div>');
  }
  const previousCourse = course;
  course = path => tab === 'catalogue' ? previousCourse(path) : workspaceCourse(path);
  q('#view')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-module-open][data-code]');
    if (!button || tab !== 'matrix' || !state) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const module = state.modules.find(module => module.id === button.dataset.moduleOpen);
    const selected = module?.courses.find(course => course.code === button.dataset.code);
    workspaceCourse(selected?.path);
  }, true);
})();
