"""Targeted catalogue reads. Authentication is enforced by the parent dispatcher."""
import datetime
import requests
from flask import request, jsonify
from atlas_catalogue_source import parse_programme, parse_course, CatalogueError
from atlas_programme_import import identity, course_paths, compare_structures, build_workspace, ProgrammeImportError

ROUTES = {'/api/programme/compare', '/api/programme/course-details', '/api/programme/prepare-import'}
MAX_HTML_BYTES = 2000000

def fetch_detail(path, kind, error):
    path, lang, year = identity(path, kind)
    try:
        with requests.get('https://catalogue.hanze.nl' + path, timeout=(6, 20), allow_redirects=False, stream=True) as response:
            if response.status_code != 200:
                raise error('Hanze did not return the selected item. The saved version remains available.', 502)
            chunks, size = [], 0
            for chunk in response.iter_content(chunk_size=32768):
                size += len(chunk)
                if size > MAX_HTML_BYTES:
                    raise error('Source page exceeded the safe download size.', 502)
                chunks.append(chunk)
            html = b''.join(chunks).decode(response.encoding or 'utf-8', errors='replace')
        parser = parse_programme if kind == 'Programme' else parse_course
        item = parser(html, path, lang, year)
        item['fetched'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return item
    except requests.Timeout:
        raise error('Hanze timed out. Retry; the saved version remains available.', 504) from None
    except requests.RequestException:
        raise error('Hanze could not be reached. The saved version remains available.', 502) from None
    except CatalogueError:
        raise error('Hanze returned an unrecognised page. No curriculum was replaced.', 422) from None

def install(legacy, error, read, detail):
    app = legacy.get('app')
    if app is not None:
        @app.after_request
        def programme_import_asset(response):
            if request.path == '/' and response.status_code == 200 and response.mimetype == 'text/html':
                html = response.get_data(as_text=True)
                if '/static/programme-import.js' not in html:
                    response.set_data(html.replace('</body>', '<script src="/static/programme-import.js?v=20261118"></script></body>'))
            return response

    def dispatch():
        if request.path not in ROUTES:
            return None
        if request.method != 'POST':
            raise error('Method not allowed.', 405)
        values = request.get_json(silent=True)
        if not isinstance(values, dict):
            raise error('JSON object required.', 400)
        try:
            if request.path == '/api/programme/compare':
                path, lang, year = identity(values.get('path'))
                saved = detail(path, 'Programme')
                online = fetch_detail(path, 'Programme', error)
                for key in ('cluster', 'mode', 'level', 'language'):
                    online[key] = saved.get(key, '')
                comparison = compare_structures(saved, online)
                return jsonify(saved=saved, online=online, comparison=comparison, coursePaths=course_paths(online))
            programme = values.get('programme')
            paths = course_paths(programme)
            source = values.get('source')
            if source not in ('saved', 'online'):
                raise ProgrammeImportError('Invalid import source')
            if request.path == '/api/programme/course-details':
                path, _, _ = identity(values.get('path'), 'course')
                if path not in paths:
                    raise ProgrammeImportError('Course is not part of the selected programme')
                item = fetch_detail(path, 'course', error) if source == 'online' else detail(path, 'course')
                return jsonify(path=path, detail=item)
            if source == 'saved':
                path, lang, year = identity(programme.get('source'))
                programme = detail(path, 'Programme')
                paths = course_paths(programme)
                data = read(year, lang)
                details = {path: data.get('courses', {})[path] for path in paths if path in data.get('courses', {})}
            else:
                details = values.get('details', {})
                if not isinstance(details, dict):
                    raise ProgrammeImportError('Course details must be an object')
            missing = [path for path in paths if path not in details]
            allow_incomplete = values.get('allowIncomplete') is True
            if missing and not allow_incomplete:
                return jsonify(error='Course details are missing. Retry or explicitly import incomplete.', missing=missing), 409
            stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
            state = build_workspace(programme, details, source, stamp, allow_incomplete=allow_incomplete)
            return jsonify(state=state)
        except ProgrammeImportError as exc:
            raise error(str(exc), 400) from None
    return dispatch
