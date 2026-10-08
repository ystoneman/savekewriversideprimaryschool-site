"""Independent sentinels for the reviewed public finance and forecast observations."""
import copy
import csv
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest

import build_case_evidence


ROOT = Path(__file__).resolve().parents[2]


class Tables(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tables = []
        self.current = None
        self.caption = False
        self.cell = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.current = {'caption': '', 'rows': []}
        elif tag == 'caption' and self.current is not None:
            self.caption = True
        elif tag in ('th', 'td') and self.current is not None:
            self.cell = ''
        elif tag == 'tr' and self.current is not None:
            self.current['rows'].append([])

    def handle_data(self, data):
        if self.caption:
            self.current['caption'] += data
        elif self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag == 'caption':
            self.caption = False
        elif tag in ('th', 'td') and self.cell is not None:
            self.current['rows'][-1].append(self.cell.strip())
            self.cell = None
        elif tag == 'table' and self.current is not None:
            self.tables.append(self.current)
            self.current = None


class CaseEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'case-evidence-data.json').read_text())

    def test_public_schema_and_source_scope(self):
        data = self.data
        build_case_evidence.validate(data)
        self.assertEqual(set(data), build_case_evidence.EXPECTED_KEYS)
        self.assertEqual(data['checkedOn'], {'finance': '2026-10-08', 'forecasts': '2026-09-23', 'boroughForecasts': '2026-10-08'})
        self.assertEqual({s['id'] for s in data['sources']}, {
            'school-balances-mar-2026', 'kew-finance-income-history',
            'kew-finance-expenditure-history', 'kew-finance-balance-history',
            'consultation-leaflet', 'consultation-kew-faq', 'kew-area-forecast-2025',
            'school-census-jan-2026', 'school-organisation-june-2026',
            'kew-budget-summary-2026', 'richmond-forecast-accuracy-2025',
        })
        self.assertTrue(all(set(s) == {'id', 'url', 'locator'} for s in data['sources']))
        self.assertNotIn('FS-Case', json.dumps(data))
        self.assertNotIn('yann.stoneman', json.dumps(data).lower())
        catalogue = {record['id']: record for record in json.loads((ROOT / 'sources.json').read_text())['records']}
        for item in data['sources']:
            self.assertIn(item['id'], catalogue)
            self.assertEqual(item['url'], catalogue[item['id']]['url'])

    def test_finance_values_dates_and_missing_bridge(self):
        data = self.data
        council = data['councilRevenueBalance']
        self.assertEqual(council['schoolUrn'], '133343')
        self.assertEqual((council['openingDate'], council['openingPence']), ('2025-03-31', 30678879))
        self.assertEqual((council['closingDate'], council['closingPence']), ('2026-03-31', 23168509))
        self.assertEqual(council['movementPence'], -7510370)
        self.assertEqual(council['closingPence'] - council['openingPence'], council['movementPence'])
        self.assertEqual([row['financialYear'] for row in data['financeHistory']],
                         ['2021/22', '2022/23', '2023/24', '2024/25', '2025/26'])
        self.assertEqual([(row['incomePence'], row['expenditurePence'], row['inYearResultPence'], row['revenueReservePence'])
                          for row in data['financeHistory']], [
            (107778600, 113142900, -5364300, 16701200),
            (115246612, 107913419, 7333193, 24034348),
            (108689400, 106658900, 2030500, 26064800),
            (107868300, 103254200, 4614100, 30678900),
            (101509800, 109020100, -7510300, 23168500),
        ])
        self.assertEqual(data['financeHistory'][1]['sourcePrecision'], 'penny')
        self.assertEqual(data['financeHistory'][-1]['sourcePrecision'], 'whole pound')
        self.assertEqual(data['pfiSchoolCharge']['amountPence'], 6964000)
        self.assertEqual(data['pfiSchoolCharge']['financialYear'], '2025/26')
        self.assertEqual(data['forecastStatements'][0]['targetFinancialYear'], '2026/27')
        self.assertIsNone(data['forecastStatements'][0]['valuePence'])
        self.assertEqual(data['forecastStatements'][1]['targetFinancialYear'], '2028/29')
        self.assertEqual(data['forecastStatements'][1]['valuePence'], 40000000)
        self.assertEqual(data['forecastStatements'][1]['comparison'], 'greater than')
        plan = data['receivedBudgetPlan']
        self.assertEqual((plan['approvalDate'], plan['receivedOn']), ('2026-05-20', '2026-10-07'))
        self.assertEqual([(r['incomePence'], r['expenditurePence'], r['annualGapPence'], r['reportedClosingPence']) for r in plan['rows']],
                         [(93365538, 114607276, 21241738, 1926770),
                          (97188536, 118706282, 21517746, -19590975),
                          (96788726, 122967950, 26179224, -45770200)])
        self.assertEqual(council['closingPence'] - sum(r['annualGapPence'] for r in plan['rows']), -45770199)
        self.assertNotIn('unavailableBudgetBridge', data)

    def test_forecast_scope_and_two_distinct_comparisons(self):
        check = self.data['forecastCheck']
        self.assertEqual((check['forecastVintage'], check['targetAcademicYear'], check['planningAreaCode']),
                         ('2024/25 SCAP submission', '2025/26', '3180007'))
        self.assertEqual(set(check['schoolUrns']), {'133343', '102884', '102921'})
        self.assertTrue(check['nurseryExcluded'])
        self.assertEqual(check['actualMeasurementDate'], '2026-01')
        self.assertEqual([(o['measure'], o['forecastPupils'], o['actualPupils'])
                          for o in check['observations']],
                         [('Reception–Year 6', 651, 654), ('Reception', 88, 97)])
        revision = self.data['forecastRevision']
        self.assertEqual((revision['targetAcademicYear'], revision['planningAreaCode'],
                          revision['earlierPupils'], revision['laterPupils']),
                         ('2031/32', '3180007', 514, 597))
        self.assertEqual(revision['laterPupils'] - revision['earlierPupils'], 83)

    def test_indicative_faq_forecast_keeps_annual_and_accumulated_values_separate(self):
        rows = self.data['indicativeBudgetForecast']
        self.assertEqual([(r['financialYear'], r['annualGapPence'], r['reportedClosingPence'], r['calculatedClosingPence']) for r in rows],
                         [('2026/27', 21241700, 1926800, 1926800),
                          ('2027/28', 21517700, -19590900, -19590900),
                          ('2028/29', 26179200, -45770200, -45770100)])
        altered = copy.deepcopy(self.data)
        altered['indicativeBudgetForecast'][0]['calculatedClosingPence'] = 0
        with self.assertRaises(ValueError):
            build_case_evidence.validate(altered)
        budget = build_case_evidence.render_budget(self.data)
        self.assertIn('future-year columns remain labelled “Indicative”', budget)
        self.assertIn('explains the earlier £1 difference', budget)
        csv_rows = {r['Observation ID']: r for r in csv.DictReader(io.StringIO(build_case_evidence.csv_text(self.data).lstrip('\ufeff')))}
        self.assertEqual(csv_rows['faq-2026/27-annualGapPence']['Value'], '212417.00')
        self.assertEqual(csv_rows['faq-2028/29-reportedClosingPence']['Value'], '-457702.00')
        self.assertEqual(csv_rows['faq-2028/29-calculatedClosingPence']['Value'], '-457701.00')

    def test_unknown_values_and_lower_bound_cannot_turn_into_exact_figures(self):
        for edit in (
            lambda d: d['receivedBudgetPlan']['rows'][1].update(incomePence=0),
            lambda d: d['forecastStatements'][0].update(valuePence=0),
            lambda d: d['forecastStatements'][1].update(comparison='equal to'),
            lambda d: d['forecastCheck'].update(planningAreaCode='other area'),
        ):
            with self.subTest(edit=edit.__code__.co_consts):
                altered = copy.deepcopy(self.data)
                edit(altered)
                with self.assertRaises(ValueError):
                    build_case_evidence.validate(altered)

    def test_html_and_csv_keep_source_precision_and_limits(self):
        budget = build_case_evidence.render_budget(self.data)
        forecast = build_case_evidence.render_forecast(self.data)
        self.assertIn('The reserve alone does not establish financial sustainability', budget)
        self.assertIn('not the council\'s entire contract liability', budget)
        self.assertIn('one forecast vintage and one period', forecast)
        self.assertIn('not itself a measured forecasting error', forecast)
        tables = {table['caption']: table['rows'] for table in Tables(budget + forecast).tables}
        actuals = tables['Kew Riverside Primary School reported financial actuals · years ending in March']
        self.assertIn(['2025/26', '£1,015,098', '£1,090,201', '−£75,103', '£231,685'], actuals)
        self.assertIn(['2022/23', '£1,152,466.12', '£1,079,134.19', '+£73,331.93', '£240,343.48'], actuals)
        check = tables['2025/26 Kew planning-area forecast compared with January 2026 census']
        self.assertIn(['Reception–Year 6', '651', '654', '+3'], check)
        self.assertIn(['Reception', '88', '97', '+9'], check)
        rows = list(csv.DictReader(io.StringIO(build_case_evidence.csv_text(self.data).lstrip('\ufeff'))))
        by_id = {row['Observation ID']: row for row in rows}
        self.assertEqual(len(by_id), len(rows), 'CSV observation IDs must be unique')
        self.assertEqual(by_id['council-closingPence']['Value'], '231685.09')
        self.assertEqual(by_id['dfe-2025/26-inYearResultPence']['Value'], '-75103.00')
        self.assertEqual(by_id['council-forecast-2028/29']['Comparator'], 'greater than')
        self.assertEqual(by_id['council-forecast-2028/29']['Value'], '400000.00')
        self.assertEqual(by_id['council-forecast-2026/27']['Value'], '')
        self.assertEqual(by_id['budget-2027/28-incomePence']['Value'], '971885.36')
        self.assertIn('Ledger, assumptions and current monitoring remain outstanding', by_id['budget-2027/28-incomePence']['Qualification'])
        self.assertEqual(by_id['forecast-check-total-difference']['Value'], '3')
        self.assertEqual(by_id['forecast-revision-difference']['Value'], '83')

    def test_borough_check_retains_scope_and_independent_source_counts(self):
        check = self.data['boroughForecastCheck']
        self.assertEqual((check['localAuthorityCode'], check['phase'], check['targetAcademicYear'], check['actualPupils']),
                         ('318', 'Primary', '2025/26', 14964))
        self.assertEqual([(r['vintage'], r['horizonYears'], r['forecastPupils']) for r in check['forecasts']],
                         [('SCAP25', 1, 15185), ('SCAP23', 3, 15468)])
        html = build_case_evidence.render_forecast(self.data)
        self.assertIn('+1.48%', html)
        self.assertIn('+3.37%', html)
        self.assertIn('not Kew-area or individual-school errors', html)
        for change in [lambda d: d['boroughForecastCheck'].update(localAuthorityCode='3180007'),
                       lambda d: d['boroughForecastCheck']['forecasts'][0].update(horizonYears=3)]:
            altered = copy.deepcopy(self.data); change(altered)
            with self.assertRaises(ValueError): build_case_evidence.validate(altered)

    def test_current_evidence_headers_follow_collection_update(self):
        from datetime import date
        checked = date.fromisoformat(json.loads((ROOT / 'sources.json').read_text())['researchChecked'])
        label = f'{checked.day} {checked:%B %Y}'
        for name, prefix in [('index.html', 'Kew evidence updated'), ('understand.html', 'Kew evidence updated'),
                             ('evidence.html', 'Source library updated'), ('faq.html', 'Selected answers updated')]:
            self.assertIn(f'<span>{prefix} {label}</span>', (ROOT / name).read_text(), name)

    def test_received_budget_is_not_still_described_as_missing_on_arrival(self):
        html = (ROOT / 'understand.html').read_text()
        hero = html.split('id="top"', 1)[1].split('</section>', 1)[0]
        self.assertIn('received final budget summary', hero)
        self.assertIn('current monitoring are still needed', hero)
        self.assertNotIn('approved budget, ledger and assumptions remain missing', html)

    def test_generated_outputs_are_current(self):
        result = subprocess.run([sys.executable, '.github/scripts/build_understand.py', '--check'],
                                cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
