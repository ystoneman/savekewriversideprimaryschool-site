"""Check the reviewed attainment export, its accessible views and provenance.

The sentinels were transcribed independently from the retained September 2026
research (RESEARCH.md and verified-attainment.json), not from the public export
or renderer. CI needs only this minimal aggregate fixture, not raw research.
Changing these historical facts requires a source review.
"""
import copy
import csv
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import unittest

from build_learning import csv_text, render

ROOT = Path(__file__).resolve().parents[2]
YEARS = ('2022/23', '2023/24', '2024/25')
GROUPS = ('Kew Riverside Primary School', 'Richmond upon Thames', 'England', 'Darell')
COMBINED = 'Reading, writing and maths'
SUBJECTS = ('Reading', 'Writing', 'Maths')
CHECKED = '2026-09-22'
SCHOOL_COHORT = 'All pupils; whole school cohort'
AREA_COHORT = 'All pupils; state-funded schools'
DARELL_COHORT = 'Whole cohort of 22, including specialist resource provision'
DFE_STATUS = 'Final; dataset version 1.0.1, published 23 April 2026'
SOURCES = {
    'dfe-school': ('https://explore-education-statistics.service.gov.uk/data-catalogue/data-set/f6cb50e9-0eca-4b1e-ac1a-6f6bb9d21a07', DFE_STATUS),
    'dfe-area': ('https://explore-education-statistics.service.gov.uk/data-catalogue/data-set/6b64a185-a49d-443e-9338-8f8bf7b67c90', DFE_STATUS),
    'dfe-cohort': ('https://explore-education-statistics.service.gov.uk/data-catalogue/data-set/3166c43a-c37e-4087-a0ec-4ed703f7a0b2', DFE_STATUS),
    'inspection': ('https://www.kewriverside.richmond.sch.uk/attachments/download.asp?file=3619&type=pdf', 'School-hosted Ofsted report; inspection 8 July 2026'),
    'darell-2026': ('https://www.darell.richmond.sch.uk/news/?nid=2&pid=22&storyid=44', 'School-reported; not matched to final DfE school data'),
    'england-2026': ('https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-2-attainment/2025-26-provisional', 'Provisional national release'),
}
# Each pair is expected / higher standard, in academic-year order.
COMBINED_RESULTS = {
    'Kew Riverside Primary School': ((75, 17), (67, 7), (73, 13)),
    'Richmond upon Thames': ((74, 18), (76, 17), (78, 21)),
    'England': ((60, 8), (61, 8), (62, 8)),
    'Darell': ((52, 22), (53, 19), (39, 9)),
}
SUBJECT_RESULTS_2025 = {
    'Kew Riverside Primary School': ((80, 47), (80, 20), (73, 33)),
    'Richmond upon Thames': ((88, 54), (83, 26), (88, 46)),
    'England': ((75, 33), (72, 13), (74, 26)),
    'Darell': ((57, 26), (57, 22), (43, 9)),
}
INSPECTION_RESULTS = {'2022/23': (92, 83, 83), '2023/24': (80, 67, 73)}
NEWER_RESULTS = {
    'Darell': ((68, 14), (68, 27), (73, 23), (73, 23)),
    'England': ((63, 9), (75, 31), (73, 13), (75, 27)),
}
COHORTS = {'Kew Riverside Primary School': (12, None, 15), 'Darell': (27, None, 23)}
CSV_HEADERS = ['School or area', 'Academic year', 'Subject', 'Measure', 'Value', 'Unit',
               'Cohort definition', 'Status', 'Source URL', 'Source location', 'Checked on']


def expected_records():
    """Expand source fixtures, preserving each source's unpopulated cells."""
    records = {}
    for group in GROUPS:
        source = 'dfe-school' if group in COHORTS else 'dfe-area'
        for index, year in enumerate(YEARS):
            records[group, year, COMBINED, source] = COMBINED_RESULTS[group][index]
            for subject_index, subject in enumerate(SUBJECTS):
                records[group, year, subject, source] = (
                    SUBJECT_RESULTS_2025[group][subject_index] if year == '2024/25' else (None, None))
    for year, percentages in INSPECTION_RESULTS.items():
        for subject, percentage in zip(SUBJECTS, percentages):
            records['Kew Riverside Primary School', year, subject, 'inspection'] = (percentage, None)
    for group, pairs in NEWER_RESULTS.items():
        source = 'darell-2026' if group == 'Darell' else 'england-2026'
        for subject, pair in zip((COMBINED,) + SUBJECTS, pairs):
            records[group, '2025/26', subject, source] = pair
    return records


def percentage(value):
    return 'Not available' if value is None else f'{value}%'


class Element:
    def __init__(self, tag, attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []

    @property
    def text(self):
        return ''.join(child.text if isinstance(child, Element) else child for child in self.children)

    def find(self, tag=None, **attrs):
        found = []
        for child in self.children:
            if isinstance(child, Element):
                if (tag is None or child.tag == tag) and all(child.attrs.get(k) == v for k, v in attrs.items()):
                    found.append(child)
                found.extend(child.find(tag, **attrs))
        return found


class Document(HTMLParser):
    """Parse structure and cell text without depending on whitespace or CSS."""
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, html):
        super().__init__()
        self.root = Element('document')
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def learning_section(html):
    sections = Document(html).root.find('section', id='learning-and-results')
    if len(sections) != 1:
        raise ValueError('Expected one learning-and-results section')
    return sections[0]


def table_rows(section):
    result = {}
    for table in section.find('table'):
        caption = table.find('caption')[0].text.strip()
        if caption in result:
            raise ValueError(f'Duplicate table caption: {caption}')
        result[caption] = [[cell.text.strip() for cell in row.children
                            if isinstance(cell, Element) and cell.tag in ('th', 'td')]
                           for row in table.find('tr')]
    return result


class LearningDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'attainment-data.json').read_text(encoding='utf-8'))
        cls.records = cls.data['records']
        cls.section = learning_section(render(cls.data))

    def test_public_schema_allows_only_aggregate_fields_and_types(self):
        self.assertEqual(set(self.data), {'schemaVersion', 'checkedOn', 'sources', 'records', 'cohorts', 'notes'})
        self.assertIs(type(self.data['schemaVersion']), int)
        self.assertEqual(self.data['schemaVersion'], 1)
        self.assertEqual(self.data['checkedOn'], CHECKED)
        for key in ('sources', 'records', 'cohorts', 'notes'):
            self.assertIs(type(self.data[key]), list)
        for note in self.data['notes']:
            self.assertIs(type(note), str)
            self.assertTrue(note.strip())
        for source in self.data['sources']:
            self.assertEqual(set(source), {'id', 'url', 'checkedOn', 'status'})
            for value in source.values():
                self.assertIs(type(value), str)
        record_keys = {'group', 'academicYear', 'subject', 'expectedPercent', 'higherPercent',
                       'cohort', 'source', 'locator', 'status'}
        for record in self.records:
            with self.subTest(record=record):
                self.assertEqual(set(record), record_keys)
                for key in record_keys - {'expectedPercent', 'higherPercent'}:
                    self.assertIs(type(record[key]), str)
                    self.assertTrue(record[key].strip())
                self.assertIn(record['group'], GROUPS)
                self.assertIn(record['subject'], (COMBINED,) + SUBJECTS)
                self.assertIn(record['academicYear'], YEARS + ('2025/26',))
                for key in ('expectedPercent', 'higherPercent'):
                    if record[key] is not None:
                        self.assertIs(type(record[key]), int, 'Do not coerce missing markers or booleans')
                        self.assertGreaterEqual(record[key], 0)
                        self.assertLessEqual(record[key], 100)
        for cohort in self.data['cohorts']:
            self.assertEqual(set(cohort), {'group', 'academicYear', 'eligiblePupils', 'source', 'status'})
            for key in ('group', 'academicYear', 'source', 'status'):
                self.assertIs(type(cohort[key]), str)
            if cohort['eligiblePupils'] is not None:
                self.assertIs(type(cohort['eligiblePupils']), int)
                self.assertGreater(cohort['eligiblePupils'], 0)

    def test_independent_source_sentinels_include_higher_standards_and_missing_cells(self):
        actual = {(r['group'], r['academicYear'], r['subject'], r['source']):
                  (r['expectedPercent'], r['higherPercent']) for r in self.records}
        self.assertEqual(len(actual), len(self.records), 'Duplicate source-specific result')
        self.assertEqual(actual, expected_records(),
                         'Review the retained primary evidence before changing historical values or filling gaps')

    def test_provenance_keeps_final_inspection_and_newer_results_separate(self):
        sources = {source['id']: source for source in self.data['sources']}
        self.assertEqual(len(sources), len(self.data['sources']))
        self.assertEqual(set(sources), set(SOURCES))
        for source_id, (url, status) in SOURCES.items():
            self.assertEqual(sources[source_id], {'id': source_id, 'url': url, 'status': status, 'checkedOn': CHECKED})
        for record in self.records:
            source = record['source']
            with self.subTest(record=record):
                self.assertIn(source, sources)
                if source in ('dfe-school', 'dfe-area'):
                    self.assertEqual(record['status'], 'Final')
                    self.assertIn(record['academicYear'], YEARS)
                    self.assertEqual(record['cohort'], SCHOOL_COHORT if source == 'dfe-school' else AREA_COHORT)
                    self.assertEqual(record['locator'], f"All pupils / Total; {record['subject']}")
                elif source == 'inspection':
                    self.assertEqual(record['status'], 'Inspection report table')
                    self.assertEqual(record['cohort'], SCHOOL_COHORT)
                    self.assertEqual(record['locator'], 'PDF page ' + ('9' if record['subject'] == 'Reading' else '10') + '; historical subject results')
                else:
                    self.assertEqual(record['academicYear'], '2025/26')
                    darell = source == 'darell-2026'
                    self.assertEqual(record['status'], 'School-reported' if darell else 'Provisional')
                    self.assertEqual(record['cohort'], DARELL_COHORT if darell else AREA_COHORT)
                    self.assertEqual(record['locator'], 'Whole-cohort results graphic' if darell else 'National headline tables')

    def test_eligible_counts_are_verified_fields_without_an_inferred_2024_count(self):
        actual = {(c['group'], c['academicYear']): c['eligiblePupils'] for c in self.data['cohorts']}
        expected = {(group, year): count for group, counts in COHORTS.items() for year, count in zip(YEARS, counts)}
        self.assertEqual(len(actual), len(self.data['cohorts']))
        self.assertEqual(actual, expected)
        for cohort in self.data['cohorts']:
            self.assertEqual(cohort['source'], 'dfe-cohort')
            self.assertEqual(cohort['status'], 'Not independently verified; not inferred'
                             if cohort['eligiblePupils'] is None else 'Verified eligible-pupil count')

    def test_csv_preserves_every_measure_source_and_missing_value(self):
        generated = csv_text(self.data)
        self.assertTrue(generated.startswith('\ufeff'), 'Keep the Excel-friendly UTF-8 BOM')
        self.assertEqual((ROOT / 'attainment.csv').read_bytes(), generated.encode('utf-8'))
        reader = csv.DictReader(io.StringIO(generated.lstrip('\ufeff'), newline=''))
        self.assertEqual(reader.fieldnames, CSV_HEADERS)
        actual = [tuple(row.values()) for row in reader]
        expected = []
        for record in self.records:
            for key, measure in (('expectedPercent', 'Expected standard'), ('higherPercent', 'Higher standard')):
                expected.append((record['group'], record['academicYear'], record['subject'], measure,
                                 'Not available' if record[key] is None else str(record[key]), 'percent',
                                 record['cohort'], record['status'], SOURCES[record['source']][0], record['locator'], CHECKED))
        for cohort in self.data['cohorts']:
            expected.append((cohort['group'], cohort['academicYear'], 'All subjects', 'Eligible pupils',
                             'Not verified' if cohort['eligiblePupils'] is None else str(cohort['eligiblePupils']),
                             'pupils', SCHOOL_COHORT, cohort['status'], SOURCES['dfe-cohort'][0], 'Eligible pupils', CHECKED))
        self.assertEqual(len(actual), len(set(actual)), 'Duplicate CSV rows')
        self.assertCountEqual(actual, expected)

    def expected_tables(self):
        combined = [['Academic year', 'School or area', 'Expected standard', 'Higher standard', 'Eligible pupils']]
        for index, year in enumerate(YEARS):
            for group in GROUPS:
                count = COHORTS[group][index] if group in COHORTS else None
                label = str(count) if count is not None else 'Not verified' if group in COHORTS else 'Not shown'
                combined.append([year, group] + [percentage(value) for value in COMBINED_RESULTS[group][index]] + [label])
        subjects = [['Subject', 'School or area', 'Expected standard', 'Higher standard']]
        for index, subject in enumerate(SUBJECTS):
            for group in GROUPS:
                subjects.append([subject, group] + [percentage(value) for value in SUBJECT_RESULTS_2025[group][index]])
        older = [['Academic year', 'Subject', 'Expected standard']]
        for year, values in INSPECTION_RESULTS.items():
            older.extend([[year, subject, percentage(value)] for subject, value in zip(SUBJECTS, values)])
        newer = [['Subject', 'Darell expected', 'Darell higher', 'England expected', 'England higher']]
        for index, subject in enumerate((COMBINED,) + SUBJECTS):
            newer.append([subject] + [percentage(value) for group in ('Darell', 'England') for value in NEWER_RESULTS[group][index]])
        return {
            'Combined reading, writing and maths · final DfE results': combined,
            'Subject attainment · 2024/25 · final DfE results': subjects,
            'Kew earlier subject attainment · inspection report, PDF pages 9–10': older,
            'Separate 2025/26 update · Darell school report and England provisional data': newer,
        }

    def test_rendered_and_published_tables_match_the_independent_source_sentinels(self):
        published = learning_section((ROOT / 'understand.html').read_text(encoding='utf-8'))
        for section in (self.section, published):
            self.assertEqual(table_rows(section), self.expected_tables())
            for table in section.find('table'):
                self.assertEqual(len(table.find('caption')), 1)
                for header in table.find('thead')[0].find('th'):
                    self.assertEqual(header.attrs.get('scope'), 'col')
                for row in table.find('tbody')[0].find('tr'):
                    self.assertEqual(row.find('th')[0].attrs.get('scope'), 'row')

    def test_chart_geometry_labels_and_lead_retain_the_pinned_comparison(self):
        values = [pair[0] for group in GROUPS[:3] for pair in COMBINED_RESULTS[group]]
        bars = [node for node in self.section.find('rect') if 'attainment-bar' in node.attrs.get('class', '').split()]
        self.assertEqual(len(bars), len(values))
        units = [float(bar.attrs['height']) / value for bar, value in zip(bars, values)]
        for unit in units:
            self.assertAlmostEqual(unit, units[0], msg='All facets must share the same percent scale')
        baselines = [float(bar.attrs['y']) + float(bar.attrs['height']) for bar in bars]
        for baseline in baselines:
            self.assertAlmostEqual(baseline, baselines[0], msg='Bars must begin at a common zero baseline')
        labels = [node.text.strip() for node in self.section.find('text') if re.fullmatch(r'\d+%', node.text.strip())]
        self.assertEqual(labels, [f'{value}%' for value in values])
        leads = [node for node in self.section.find('p') if 'section-lead' in node.attrs.get('class', '').split()]
        self.assertEqual(re.findall(r'\d+%', leads[0].text), ['73%', '62%', '78%'])
        lead = leads[1]
        lead_values = [f'{pair[0]}%' for group in ('Kew Riverside Primary School', 'England', 'Richmond upon Thames')
                       for pair in COMBINED_RESULTS[group]]
        self.assertEqual(re.findall(r'\d+%', lead.text), lead_values)
        self.assertIn('below the borough figure in 2024 and 2025', lead.text)
        note = self.section.find('p', id='newer-darell-results')[0].text
        for fact in ('68%', '22 pupils', '63%', 'school announcement', 'provisional', 'different years and publication stages'):
            self.assertIn(fact, note)

    def test_chart_and_table_values_come_from_data_instead_of_literal_markup(self):
        changed = copy.deepcopy(self.data)
        record = next(r for r in changed['records'] if (r['group'], r['academicYear'], r['subject']) ==
                      ('Kew Riverside Primary School', '2022/23', COMBINED))
        record['expectedPercent'] = 42
        section = learning_section(render(changed))
        combined = table_rows(section)['Combined reading, writing and maths · final DfE results']
        self.assertEqual(combined[1], ['2022/23', 'Kew Riverside Primary School', '42%', '17%', '12'])
        before = [node for node in self.section.find('rect') if 'attainment-bar' in node.attrs.get('class', '').split()]
        after = [node for node in section.find('rect') if 'attainment-bar' in node.attrs.get('class', '').split()]
        self.assertEqual(len(after), len(before))
        self.assertAlmostEqual(float(after[0].attrs['height']) / float(before[0].attrs['height']), 42 / 75)
        self.assertEqual([bar.attrs for bar in after[1:]], [bar.attrs for bar in before[1:]])
        labels = [node.text.strip() for node in section.find('text') if re.fullmatch(r'\d+%', node.text.strip())]
        self.assertEqual(labels[0], '42%')
        # Editorial source summaries intentionally remain pinned to verified facts.


if __name__ == '__main__':
    unittest.main()
