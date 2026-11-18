"""Pure comparison and workspace snapshots for targeted programme imports.

No HTTP, database writes or GitHub publication occurs in this module.
"""
import copy
import json
import re
from collections import Counter
from urllib.parse import urlsplit

BASE = 'https://catalogue.hanze.nl'
PATH = re.compile(r'/(nl|en)/(Programme|course)/(20\d{2})/([A-Za-z0-9_-]+)', re.I)
MAX_WORKSPACE_BYTES = 4000000

class ProgrammeImportError(ValueError):
    pass

def identity(value, kind='Programme'):
    if not isinstance(value, str):
        raise ProgrammeImportError('Catalogue source is required')
    url = urlsplit(value)
    if url.scheme or url.netloc:
        if url.scheme != 'https' or url.netloc != 'catalogue.hanze.nl':
            raise ProgrammeImportError('Only the Hanze catalogue source is allowed')
    if url.query or url.fragment:
        raise ProgrammeImportError('Catalogue queries and fragments are not allowed')
    match = PATH.fullmatch(url.path)
    if not match or match[2].lower() != kind.lower():
        raise ProgrammeImportError('Invalid catalogue source path')
    return url.path, match[1].lower(), match[3]

def validate_structure(programme):
    if not isinstance(programme, dict):
        raise ProgrammeImportError('Programme must be an object')
    path, lang, year = identity(programme.get('source'))
    if str(programme.get('edition')) != year:
        raise ProgrammeImportError('Programme edition does not match its source')
    if not isinstance(programme.get('programme'), str) or not programme['programme'].strip():
        raise ProgrammeImportError('Programme name is required')
    modules = programme.get('modules')
    if not isinstance(modules, list) or not 1 <= len(modules) <= 500:
        raise ProgrammeImportError('Programme must contain 1-500 modules')
    count = 0
    for module in modules:
        if not isinstance(module, dict) or not isinstance(module.get('name'), str):
            raise ProgrammeImportError('Invalid programme module')
        if type(module.get('year')) is not int or not 1 <= module['year'] <= 10:
            raise ProgrammeImportError('Invalid study year')
        courses = module.get('courses')
        if not isinstance(courses, list):
            raise ProgrammeImportError('Module course list is required')
        count += len(courses)
        if count > 5000:
            raise ProgrammeImportError('Programme course-reference limit exceeded')
        for course in courses:
            if not isinstance(course, dict) or not isinstance(course.get('code'), str):
                raise ProgrammeImportError('Invalid programme course')
            _, course_lang, course_year = identity(course.get('path'), 'course')
            if (course_lang, course_year) != (lang, year):
                raise ProgrammeImportError('Course belongs to a different edition or language')
    return path, lang, year

def course_paths(programme):
    validate_structure(programme)
    return list(dict.fromkeys(course['path'] for module in programme['modules'] for course in module['courses']))

def canonical_structure(programme):
    path, lang, year = validate_structure(programme)
    return {'path': path, 'lang': lang, 'edition': year, 'programme': programme['programme'],
            'modules': [{'name': module['name'], 'year': module['year'],
                         'yearInferred': bool(module.get('yearInferred')),
                         'ects': str(module.get('ects', '')), 'elective': bool(module.get('elective')),
                         'courses': [{'path': course['path'], 'code': course['code'],
                                      'name': str(course.get('name', '')), 'ects': str(course.get('ects', ''))}
                                     for course in module['courses']]}
                        for module in programme['modules']]}

def compare_structures(saved, online):
    old, new = canonical_structure(saved), canonical_structure(online)
    if (old['path'], old['lang'], old['edition']) != (new['path'], new['lang'], new['edition']):
        raise ProgrammeImportError('Only the same programme, edition and language can be compared')
    def counts(structure):
        return Counter(course['path'] for module in structure['modules'] for course in module['courses'])
    old_courses, new_courses = counts(old), counts(new)
    old_modules = Counter((module['name'], module['year']) for module in old['modules'])
    new_modules = Counter((module['name'], module['year']) for module in new['modules'])
    return {'changed': old != new, 'programmeNameChanged': old['programme'] != new['programme'],
            'modulesAdded': list((new_modules - old_modules).elements()),
            'modulesRemoved': list((old_modules - new_modules).elements()),
            'courseReferencesAdded': list((new_courses - old_courses).elements()),
            'courseReferencesRemoved': list((old_courses - new_courses).elements()),
            'saved': old, 'online': new}

def build_workspace(programme, details, source, stamp, allow_incomplete=False):
    if source not in ('saved', 'online') or not isinstance(stamp, str) or not stamp:
        raise ProgrammeImportError('Explicit import source and timestamp are required')
    paths = course_paths(programme)
    if not isinstance(details, dict):
        raise ProgrammeImportError('Course details must be an object')
    retained = {}
    for path in paths:
        if path not in details:
            continue
        detail = details[path]
        if not isinstance(detail, dict) or not isinstance(detail.get('metadata'), dict):
            raise ProgrammeImportError('Invalid course metadata')
        if any(not isinstance(detail.get(key), str) for key in ('outcomes', 'content', 'fetched')):
            raise ProgrammeImportError('Course content and retrieval date must be strings')
        if identity(detail.get('source'), 'course')[0] != path:
            raise ProgrammeImportError('Course details do not match the selected programme')
        retained[path] = copy.deepcopy(detail)
    missing = [path for path in paths if path not in retained]
    if missing and not allow_incomplete:
        raise ProgrammeImportError('Some course details are missing; retry or explicitly allow an incomplete import')
    workspace = copy.deepcopy(programme)
    workspace['mappings'] = {}
    workspace['targets'] = {}
    workspace['courseDetails'] = retained
    workspace['catalogueImport'] = {'version': 1, 'source': source, 'importedAt': stamp,
                                   'complete': not missing, 'missingCourses': missing}
    for key in ('id', 'revision', 'archived', 'archivedAt', 'deleted_at'):
        workspace.pop(key, None)
    if len(json.dumps(workspace, ensure_ascii=False, allow_nan=False).encode('utf-8')) > MAX_WORKSPACE_BYTES:
        raise ProgrammeImportError('Workspace is too large to import safely with embedded course details')
    return workspace
