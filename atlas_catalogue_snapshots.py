"""Read-only catalogue snapshots for authenticated hosted routes."""
import copy
import json
import re
from functools import lru_cache
from flask import request, jsonify

ROUTES = {'/api/search', '/api/catalogue-clusters', '/api/programme', '/api/course', '/api/catalogue-cache/status'}

def install(legacy, error):
    root = legacy['ROOT'] / 'data' / 'catalogue-cache'

    def filters(values):
        year = str(values.get('year', '2026'))
        lang = values.get('lang', 'nl')
        if lang not in ('nl', 'en') or not re.fullmatch(r'20\d{2}', year):
            raise error('Invalid catalogue edition or language.', 400)
        return year, lang

    @lru_cache(maxsize=8)
    def load(year, lang, modified, size):
        try:
            data = json.loads((root / f'{lang}-{year}.json').read_text(encoding='utf-8'))
        except (OSError, ValueError):
            raise error('Catalogue snapshot cannot be read. Replace the snapshot and redeploy.', 503)
        if not isinstance(data, dict) or not isinstance(data.get('results'), list) or not isinstance(data.get('courses', {}), dict):
            raise error('Invalid catalogue snapshot format.', 503)
        return data

    def read(year, lang, required=True):
        path = root / f'{lang}-{year}.json'
        try:
            stat = path.stat()
        except FileNotFoundError:
            if not required:
                return None
            raise error('No catalogue snapshot for this edition and language. Upload it and redeploy.', 404)
        except OSError:
            raise error('Catalogue snapshot is unavailable.', 503)
        return load(year, lang, stat.st_mtime_ns, stat.st_size)

    def clusters(data):
        return data.get('clusters') or [{'id': name, 'name': name} for name in sorted({r.get('cluster', '') for r in data['results'] if r.get('cluster')})]

    def detail(path, kind):
        match = re.fullmatch(r'/(nl|en)/(Programme|course)/(20\d{2})/([A-Za-z0-9_-]+)', str(path), re.I)
        if not match or match[2].lower() != kind.lower():
            raise error('Invalid catalogue link.', 400)
        data = read(match[3], match[1].lower())
        if kind == 'Programme':
            item = next((r.get('programme') for r in data['results'] if r.get('path') == path and r.get('programme')), None)
        else:
            item = data.get('courses', {}).get(path)
        if not isinstance(item, dict):
            raise error('Item is not available in the deployed catalogue snapshot.', 404)
        return copy.deepcopy(item)

    legacy['structure_for'] = lambda path: (detail(path, 'Programme'), True)

    def metadata(data):
        if data is None:
            return {}
        return {'saved': data.get('saved') or data.get('fetched', ''), 'complete': bool(data.get('complete')), 'programmes': sum('/programme/' in r.get('path', '').lower() for r in data['results']), 'courses': len(data.get('courses', {})), 'totalCourses': data.get('totalCourses', len(data.get('courses', {})))}

    def dispatch():
        if request.path not in ROUTES:
            return None
        if request.path in ('/api/programme', '/api/course'):
            if request.method != 'POST':
                raise error('Method not allowed.', 405)
            values = request.get_json(silent=True)
            if not isinstance(values, dict):
                raise error('JSON object required.', 400)
            return jsonify(detail(values.get('path'), 'Programme' if request.path == '/api/programme' else 'course'))
        if request.path == '/api/search':
            if request.method != 'POST':
                raise error('Method not allowed.', 405)
            values = request.get_json(silent=True)
            if not isinstance(values, dict):
                raise error('JSON object required.', 400)
            year, lang = filters(values)
            data = read(year, lang)
            kind = values.get('kind', 'Programme')
            if kind not in ('Programme', 'Course'):
                raise error('Invalid catalogue search kind.', 400)
            rows = {r['path']: dict(r) for r in data['results'] if '/' + kind.lower() + '/' in r.get('path', '').lower()}
            if kind == 'Course':
                for programme in data['results']:
                    for module in (programme.get('programme') or {}).get('modules', []):
                        for course in module.get('courses', []):
                            path = course.get('path')
                            if not path:
                                continue
                            row = rows.setdefault(path, {'name': (str(course.get('code', '')) + ' ' + str(course.get('name', ''))).strip(), 'path': path, 'cluster': programme.get('cluster', ''), 'mode': '', 'level': '', 'language': ''})
                            row.setdefault('_clusters', []).append(programme.get('cluster', ''))
            want = str(values.get('cluster', ''))
            want = next((str(c.get('name', '')) for c in clusters(data) if str(c.get('id')) == want), want)
            norm = lambda value: re.sub(r'\s+', ' ', str(value or '')).strip().casefold()
            def matches(row):
                names = [row.get('cluster', '')] + row.get('_clusters', []) + list(row.get('clusters') or [])
                return not want or any(norm(want) and norm(name) and (norm(want) == norm(name) or norm(want) in norm(name) or norm(name) in norm(want)) for name in names)
            query = str(values.get('q', ''))[:150].strip().casefold()
            result = [{k: v for k, v in row.items() if k not in ('programme', 'clusters', '_clusters')} for row in rows.values() if matches(row) and (not query or query in ' '.join(str(row.get(k, '')) for k in ('name', 'path', 'cluster', 'mode', 'level', 'language')).casefold())]
            saved = data.get('saved') or data.get('fetched', '')
            return jsonify(results=result, count=str(len(result)), total=len(result), complete=bool(data.get('complete')), truncated=not bool(data.get('complete')), clusters=clusters(data), fetched=saved, warning=('Opgeslagen catalogus van ' if lang == 'nl' else 'Saved catalogue from ') + str(saved or '?'), offline=True, source='snapshot')
        if request.method != 'GET':
            raise error('Method not allowed.', 405)
        year, lang = filters(request.args)
        if request.path == '/api/catalogue-clusters':
            data = read(year, lang)
            return jsonify(clusters=clusters(data), offline=True, fetched=data.get('saved') or data.get('fetched', ''), source='snapshot')
        languages = {l: metadata(read(year, l, required=False)) for l in ('nl', 'en')}
        meta = languages[lang]
        return jsonify(available=bool(meta), year=year, lang=lang, saved=meta.get('saved', ''), complete=bool(meta.get('complete')), programmes=meta.get('programmes', 0), courses=meta.get('courses', 0), totalCourses=meta.get('totalCourses', 0), languages=languages, job={}, readOnly=True, source='snapshot')
    return dispatch
