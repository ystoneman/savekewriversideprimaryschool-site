"""Check dated school comparisons independently of browser rendering.

The source sentinels below were checked directly against the two pinned DfE
downloads, independently of the extraction script. Raw national data stays out
of this public repository; CI checks the minimal reviewed export and its views.
"""
import copy
import csv
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import subprocess
import sys
import unittest

from build_understand import render

ROOT = Path(__file__).resolve().parents[2]
LABELS = ['Reception'] + [f'Year {number}' for number in range(1, 7)]


class Tables(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tables = []
        self.table = self.row = self.cell = None
        self.caption = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'table':
            self.table = {'caption': '', 'rows': {}}
        elif tag == 'caption' and self.table is not None:
            self.caption = True
        elif tag == 'tr' and self.table is not None and 'data-school' in attrs:
            self.row = (attrs['data-school'], [])
        elif tag == 'td' and self.row is not None:
            self.cell = ''

    def handle_data(self, data):
        if self.caption:
            self.table['caption'] += data
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag == 'caption':
            self.caption = False
        elif tag == 'td' and self.cell is not None:
            self.row[1].append(self.cell.strip())
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            urn, values = self.row
            if urn in self.table['rows']:
                raise ValueError(f'Duplicate school row: {urn}')
            self.table['rows'][urn] = values
            self.row = None
        elif tag == 'table':
            self.tables.append(self.table)
            self.table = None


class UnderstandDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'understand-data.json').read_text(encoding='utf-8'))
        cls.schools = cls.data['schools']
        cls.by_urn = {school['urn']: school for school in cls.schools}

    def integer(self, value, positive=False):
        self.assertIs(type(value), int, 'Suppressed, missing or fractional counts must not become zero')
        self.assertGreaterEqual(value, 1 if positive else 0)

    def test_generated_html_and_csv_match_the_reviewed_dataset(self):
        result = subprocess.run([sys.executable, str(ROOT / '.github/scripts/build_understand.py'), '--check'],
                                cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_public_schema_contains_only_reviewed_aggregate_fields(self):
        self.assertEqual(set(self.data), {'schemaVersion', 'checkedOn', 'sources', 'years', 'nearbyUrns',
                                         'borough', 'schools', 'notes', 'sourceMetadata'})
        self.assertEqual(self.data['schemaVersion'], 1)
        school_keys = {'urn', 'laestab', 'name', 'shortName', 'nearby', 'schoolType',
                       'schoolPhaseCode', 'schoolPhaseLabel', 'ageRange', 'ageRangeStatus',
                       'capacity2025', 'history', 'cohorts2026'}
        for school in self.schools:
            with self.subTest(school=school['urn']):
                self.assertEqual(set(school), school_keys)
                self.assertRegex(school['urn'], r'^\d{6}$')
                self.assertRegex(school['laestab'], r'^\d{7}$')
                self.assertIsNone(school['ageRange'], 'Do not infer provision ages from zero cohorts')
                self.assertEqual(set(school['capacity2025']), {'roll', 'capacity', 'unfilledPlaces',
                                                             'pupilsOverCapacity', 'occupancyPercent'})
                self.assertEqual(set(school['cohorts2026']), {'labels', 'counts', 'totalExcludingNursery', 'nurseryPupils'})
                for history in school['history']:
                    self.assertEqual(set(history), {'year', 'roll', 'capacity', 'urn', 'sourceNames', 'sourceSiteCount'})
        source_keys = {'id', 'title', 'publisher', 'published', 'measurementDate', 'url',
                       'downloadUrl', 'sha256', 'file'}
        for source in self.data['sources']:
            self.assertEqual(set(source) - {'releaseUpdated'}, source_keys)
            self.assertRegex(source['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(source['url'].startswith('https://'))
        # The raw census contains demographic and SEND breakdowns. None belong
        # in this comparison, including metadata or a future nested field.
        metadata = self.data['sourceMetadata']
        self.assertEqual(set(metadata), {'capacityRawRowCount', 'capacityRowsPerYear', 'uniqueSchoolsPerYear',
                                        'censusSchoolRowCount', 'splitSites', 'historyJoinField',
                                        'urnChanges', 'methodologyUrls', 'schoolNameEvidence'})
        for item in metadata['splitSites']:
            self.assertEqual(set(item), {'urn', 'name', 'treatment'})
        for item in metadata['urnChanges']:
            self.assertEqual(set(item), {'laestab', 'name', 'sourceYearUrns'})
        self.assertEqual(set(metadata['schoolNameEvidence']), {'urn', 'currentName', 'formerName',
                                                             'currentNameFirstSelectedSourceYear', 'schoolUrl', 'evidence'})

    def test_school_arithmetic_and_snapshot_alignment(self):
        years = [year['key'] for year in self.data['years']]
        self.assertEqual(len(self.schools), len(self.by_urn), 'School URNs must be unique')
        self.assertEqual(len(self.schools), len({school['laestab'] for school in self.schools}))
        self.assertEqual(set(self.data['nearbyUrns']), {s['urn'] for s in self.schools if s['nearby']})
        for school in self.schools:
            with self.subTest(school=school['urn']):
                self.assertEqual([item['year'] for item in school['history']], years)
                for history in school['history']:
                    self.integer(history['roll'])
                    self.integer(history['capacity'], positive=True)
                    self.integer(history['sourceSiteCount'], positive=True)
                    self.assertEqual(len(history['sourceNames']), history['sourceSiteCount'])
                latest = school['capacity2025']
                self.assertEqual(latest['roll'], school['history'][-1]['roll'])
                self.assertEqual(latest['capacity'], school['history'][-1]['capacity'])
                self.assertEqual(school['urn'], school['history'][-1]['urn'])
                for key in ['roll', 'capacity', 'unfilledPlaces', 'pupilsOverCapacity']:
                    self.integer(latest[key], positive=key == 'capacity')
                self.assertEqual(latest['unfilledPlaces'], max(0, latest['capacity'] - latest['roll']))
                self.assertEqual(latest['pupilsOverCapacity'], max(0, latest['roll'] - latest['capacity']))
                self.assertTrue(math.isfinite(latest['occupancyPercent']))
                self.assertAlmostEqual(latest['occupancyPercent'], 100 * latest['roll'] / latest['capacity'], places=4)
                cohort = school['cohorts2026']
                self.assertEqual(cohort['labels'], LABELS)
                self.assertEqual(len(cohort['counts']), len(LABELS))
                for count in cohort['counts'] + [cohort['totalExcludingNursery'], cohort['nurseryPupils']]:
                    self.integer(count)
                self.assertEqual(cohort['totalExcludingNursery'], sum(cohort['counts']))

    def test_borough_totals_and_site_aggregation_reconcile(self):
        metadata = self.data['sourceMetadata']
        self.assertEqual(metadata['uniqueSchoolsPerYear'], len(self.schools))
        self.assertEqual(metadata['censusSchoolRowCount'], len(self.schools))
        self.assertEqual(metadata['capacityRawRowCount'], metadata['capacityRowsPerYear'] * len(self.data['years']))
        self.assertEqual([item['year'] for item in self.data['borough']], [year['key'] for year in self.data['years']])
        for index, borough in enumerate(self.data['borough']):
            self.assertEqual(set(borough), {'year', 'roll', 'capacity', 'schoolCount'})
            self.assertEqual(borough['schoolCount'], len(self.schools))
            self.assertEqual(borough['roll'], sum(s['history'][index]['roll'] for s in self.schools))
            self.assertEqual(borough['capacity'], sum(s['history'][index]['capacity'] for s in self.schools))
            self.assertEqual(metadata['capacityRowsPerYear'], sum(s['history'][index]['sourceSiteCount'] for s in self.schools))

    def test_independently_checked_source_sentinels_keep_their_dates(self):
        # These are historical facts from the checked downloads, not values
        # computed from the implementation under test. Review before replacing.
        sources = {source['id']: source for source in self.data['sources']}
        self.assertEqual(sources['dfe-capacity-2025']['measurementDate'], '2025-05')
        self.assertEqual(sources['dfe-capacity-2025']['sha256'], '0cb91343ed515d7cc513cc8fded9827df27c4d51099a1c2c1384d50d62f8dca5')
        self.assertEqual(sources['dfe-census-2026']['measurementDate'], '2026-01')
        self.assertEqual(sources['dfe-census-2026']['sha256'], '14fd1d59157b3495da7d5caabbcb28ecd2f8048525b25b47ebc93ac57c058c93')
        self.assertEqual([y['censusMonth'] for y in self.data['years']], ['2022-05', '2023-05', '2024-05', '2025-05'])
        sentinels = {
            '133343': ([142, 107, 102, 90], 210, [14, 8, 10, 11, 18, 14, 9]),
            '102884': ([177, 193, 194, 177], 420, [23, 24, 28, 29, 24, 24, 21]),
            '102921': ([366, 394, 398, 392], 420, [60, 58, 59, 58, 59, 55, 48]),
            '139549': ([365, 375, 369, 364], 420, [60, 51, 54, 51, 45, 50, 55]),
        }
        for urn, (history, capacity, cohorts) in sentinels.items():
            with self.subTest(school=urn):
                school = self.by_urn[urn]
                self.assertEqual([item['roll'] for item in school['history']], history)
                self.assertEqual(school['capacity2025']['capacity'], capacity)
                self.assertEqual(school['cohorts2026']['counts'], cohorts)
        self.assertEqual([h['sourceSiteCount'] for h in self.by_urn['139549']['history']], [2, 2, 2, 2])

    def test_missing_or_suppressed_display_values_fail_instead_of_becoming_zero(self):
        for value in ['c', 'x', '', None]:
            for path in ['history', 'cohort', 'capacity']:
                with self.subTest(value=value, field=path):
                    damaged = copy.deepcopy(self.data)
                    school = damaged['schools'][0]
                    if path == 'history':
                        school['history'][0]['roll'] = value
                    elif path == 'cohort':
                        school['cohorts2026']['counts'][0] = value
                    else:
                        school['capacity2025']['capacity'] = value
                    with self.assertRaises((TypeError, ValueError, ZeroDivisionError)):
                        render(damaged)

    def test_csv_contains_each_measure_once_with_its_date_and_unit(self):
        content = (ROOT / 'richmond-schools.csv').read_bytes()
        self.assertTrue(content.startswith(b'\xef\xbb\xbf'), 'Keep the Excel-friendly UTF-8 BOM')
        with (ROOT / 'richmond-schools.csv').open(encoding='utf-8-sig', newline='') as stream:
            reader = csv.DictReader(stream)
            self.assertEqual(reader.fieldnames, ['School', 'Current URN', 'School establishment number',
                                                'Measure', 'Measurement date', 'Academic year', 'Year group',
                                                'Value', 'Unit', 'Source URL'])
            actual = [tuple(row.values()) for row in reader]
        expected = []
        sources = {source['id']: source for source in self.data['sources']}
        for school in self.schools:
            prefix = (school['name'], school['urn'], school['laestab'])
            for period, history in zip(self.data['years'], school['history']):
                for measure, key, unit in [('Pupils excluding nursery', 'roll', 'pupils'),
                                           ('Reported capacity excluding nursery', 'capacity', 'places')]:
                    expected.append(prefix + (measure, period['censusMonth'], period['label'], '',
                                               str(history[key]), unit, sources['dfe-capacity-2025']['url']))
            for label, count in zip(LABELS, school['cohorts2026']['counts']):
                expected.append(prefix + ('Pupils by curriculum year', '2026-01', '2025/26', label,
                                           str(count), 'pupils', sources['dfe-census-2026']['url']))
        self.assertEqual(len(actual), len(set(actual)), 'Duplicate download rows')
        self.assertCountEqual(actual, expected)

    def test_accessible_html_tables_match_counts_and_calculated_values(self):
        # Attainment tables have a separate schema and tests; preserve these four school-roll tables.
        tables = [table for table in Tables((ROOT / 'understand.html').read_text(encoding='utf-8')).tables if table['rows']]
        self.assertEqual(len(tables), 4)
        trends = [table for table in tables if 'pupil numbers' in table['caption']]
        self.assertEqual(len(trends), 2)
        for table in trends:
            expected_ids = set(self.data['nearbyUrns']) if table['caption'].startswith('Local') else set(self.by_urn)
            self.assertEqual(set(table['rows']), expected_ids)
            for urn, actual in table['rows'].items():
                rolls = [history['roll'] for history in self.by_urn[urn]['history']]
                delta = (rolls[-1] - rolls[0]) / rolls[0] * 100
                sign = '+' if delta > 0 else '−' if delta < 0 else ''
                self.assertEqual(actual, [str(roll) for roll in rolls] + [f'{sign}{abs(delta):.1f}%'])
        places = next(table for table in tables if table['caption'] == 'Richmond school places · May 2025')
        cohorts = next(table for table in tables if table['caption'] == 'Richmond year-group counts · January 2026, excluding nursery')
        self.assertEqual(set(places['rows']), set(self.by_urn))
        self.assertEqual(set(cohorts['rows']), set(self.by_urn))
        for urn, school in self.by_urn.items():
            count = school['capacity2025']
            self.assertEqual(places['rows'][urn], [str(count['roll']), str(count['capacity']),
                                                  f"{100 * count['roll'] / count['capacity']:.1f}%",
                                                  str(count['unfilledPlaces']), str(count['pupilsOverCapacity'])])
            self.assertEqual(cohorts['rows'][urn], [str(value) for value in school['cohorts2026']['counts']] +
                             [str(school['cohorts2026']['totalExcludingNursery'])])


if __name__ == '__main__':
    unittest.main()
