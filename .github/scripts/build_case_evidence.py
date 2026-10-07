"""Render reviewed Kew finance and planning-area observations for Understand.

This module accepts only the small public case-evidence-data.json schema. Annual
budgets absent from reviewed sources remain null and cannot become zero in HTML
or CSV. The upstream primary-source snapshots live outside this public site.
"""
import csv
from html import escape
import io


EXPECTED_KEYS = {
    'schemaVersion', 'checkedOn', 'sources', 'financeHistory',
    'councilRevenueBalance', 'forecastStatements', 'unavailableBudgetBridge',
    'pfiSchoolCharge', 'forecastCheck', 'forecastRevision', 'indicativeBudgetForecast',
}


def e(value):
    return escape(str(value), quote=True)


def money(pence, precision='penny', signed=False):
    if pence is None:
        return 'Not available'
    sign = '−' if pence < 0 else '+' if signed and pence > 0 else ''
    pounds, pennies = divmod(abs(pence), 100)
    digits = f'£{pounds:,}' if precision == 'whole pound' else f'£{pounds:,}.{pennies:02d}'
    return sign + digits


def decimal_pounds(pence):
    """Preserve penny precision without binary floating-point conversion."""
    sign = '-' if pence < 0 else ''
    pounds, pennies = divmod(abs(pence), 100)
    return f'{sign}{pounds}.{pennies:02d}'


def source(data, source_id):
    return next(record for record in data['sources'] if record['id'] == source_id)


def source_link(data, source_id, label):
    record = source(data, source_id)
    return (f'<a href="evidence.html#source-{e(source_id)}">{e(label)}</a>'
            f' (<a href="{e(record["url"])}">original ↗&#xFE0E;</a>)')


def table(caption, headers, rows):
    cells = ''.join('<tr><th scope="row">' + e(row[0]) + '</th>'
                    + ''.join('<td>' + e(value) + '</td>' for value in row[1:])
                    + '</tr>' for row in rows)
    return (f'<div class="data-table-scroll" role="region" aria-label="{e(caption)}; scroll horizontally if needed" tabindex="0">'
            f'<table><caption>{e(caption)}</caption><thead><tr>'
            + ''.join(f'<th scope="col">{e(header)}</th>' for header in headers)
            + f'</tr></thead><tbody>{cells}</tbody></table></div>')


def validate(data):
    if set(data) != EXPECTED_KEYS or data['schemaVersion'] != 1:
        raise ValueError('Unexpected public case-evidence schema')
    sources = data['sources']
    if len({item['id'] for item in sources}) != len(sources):
        raise ValueError('Duplicate source ID')
    if any(set(item) != {'id', 'url', 'locator'} or not item['url'].startswith('https://') for item in sources):
        raise ValueError('Source metadata must be public, minimal and directly linkable')
    if len(data['financeHistory']) != 5:
        raise ValueError('Expected five reported financial years')
    for item in data['financeHistory']:
        if set(item) != {'financialYear', 'yearEnd', 'incomePence', 'expenditurePence',
                         'inYearResultPence', 'revenueReservePence', 'sourcePrecision'}:
            raise ValueError('Unexpected financial history fields')
        if item['sourcePrecision'] not in ('whole pound', 'penny'):
            raise ValueError('Unknown financial source precision')
        for key in ('incomePence', 'expenditurePence', 'inYearResultPence', 'revenueReservePence'):
            if type(item[key]) is not int:
                raise ValueError(f'Missing or invalid reported amount: {key}')
    previous = 23168500
    for entry in data['indicativeBudgetForecast']:
        if set(entry) != {'financialYear', 'annualGapPence', 'reportedClosingPence', 'calculatedClosingPence', 'sourceId'}:
            raise ValueError('Unexpected indicative forecast fields')
        if any(type(entry[key]) is not int for key in ('annualGapPence', 'reportedClosingPence', 'calculatedClosingPence')):
            raise ValueError('Indicative amounts must be integer pence')
        if previous - entry['annualGapPence'] != entry['calculatedClosingPence']:
            raise ValueError('Indicative reserve bridge does not reconcile')
        if abs(entry['reportedClosingPence'] - entry['calculatedClosingPence']) > 100:
            raise ValueError('Published rounding discrepancy exceeds one pound')
        source(data, entry['sourceId'])
        previous = entry['calculatedClosingPence']
    for entry in data['unavailableBudgetBridge']:
        if set(entry) != {'financialYear', 'incomePence', 'expenditurePence', 'closingRevenueReservePence'}:
            raise ValueError('Unexpected budget bridge fields')
        if any(entry[key] is not None for key in ('incomePence', 'expenditurePence', 'closingRevenueReservePence')):
            raise ValueError('Unavailable annual budget must remain null')
    if data['forecastStatements'][0]['valuePence'] is not None:
        raise ValueError('Council gave no numeric March 2027 reserve')
    if data['forecastStatements'][1]['comparison'] != 'greater than':
        raise ValueError('Council deficit is a lower bound, not an exact amount')
    if {item['measure'] for item in data['forecastCheck']['observations']} != {'Reception–Year 6', 'Reception'}:
        raise ValueError('Forecast check needs both matched total and Reception counts')
    for item in data['forecastStatements']:
        source(data, item['sourceId'])
    for field in ('sourceId',):
        source(data, data['councilRevenueBalance'][field])
        source(data, data['pfiSchoolCharge'][field])
    check = data['forecastCheck']
    if check['planningAreaCode'] != '3180007' or set(check['schoolUrns']) != {'133343', '102884', '102921'} or check['nurseryExcluded'] is not True:
        raise ValueError('Forecast check must retain the matched Kew primary planning area')
    source(data, check['forecastSourceId'])
    source(data, check['actualSourceId'])
    revision = data['forecastRevision']
    if revision['planningAreaCode'] != check['planningAreaCode'] or revision['geography'] != check['geography']:
        raise ValueError('Forecast revision must use the same planning area')
    source(data, revision['earlierSourceId'])
    source(data, revision['laterSourceId'])


def render_budget(data):
    validate(data)
    council = data['councilRevenueBalance']
    statements = data['forecastStatements']
    exact = council['closingPence']
    fall = abs(council['movementPence'])
    actuals = data['financeHistory']
    school_pfi = data['pfiSchoolCharge']
    exhaustion_year = 2000 + int(statements[0]['targetFinancialYear'].split('/')[1])
    bound = money(statements[1]['valuePence'], 'whole pound')
    sequence = table('Reported reserve and council projection · different dates and measures',
                     ['When', 'Type', 'What the source says'], [
                         ['31 March 2026', 'Actual revenue reserve', money(exact)],
                         [f'31 March {exhaustion_year}', 'FAQ Q5 indicative projection', '£19,268 remaining reserve'],
                         [f'By {statements[1]["targetFinancialYear"]}', 'Council projection', f'More than {bound} accumulated deficit'],
                     ])
    history = table('Kew Riverside Primary School reported financial actuals · years ending in March',
                    ['Financial year', 'Income', 'Expenditure', 'In-year result', 'Year-end revenue reserve'], [
                        [item['financialYear'], money(item['incomePence'], item['sourcePrecision']),
                         money(item['expenditurePence'], item['sourcePrecision']),
                         money(item['inYearResultPence'], item['sourcePrecision'], signed=True),
                         money(item['revenueReservePence'], item['sourcePrecision'])]
                        for item in actuals
                    ])
    indicative = table('FAQ Q5 indicative school budget · forecasts, not approved accounts',
                       ['Financial year', 'Annual budget gap', 'Published year-end position'],
                       [[row['financialYear'], money(row['annualGapPence']), money(row['reportedClosingPence'])]
                        for row in data['indicativeBudgetForecast']])
    return f'''
<section class="data-section" id="budget" aria-labelledby="budget-title"><p class="eyebrow">05 / School finances</p><h2 id="budget-title">What do the school finances show?</h2>
<p class="section-lead">The council’s forecast puts Kew’s <strong>annual budget gap at £212,417 in 2026/27</strong> and its <strong>accumulated deficit at £457,702 by 2028/29</strong>.</p>
<span class="data-date">Forecast: 2026/27 → 2028/29 · checked {e(data['checkedOn']['finance'])}</span>
<p class="data-context">These are indicative forecasts, not the approved budget or cash available today. The accumulated deficit is not an annual loss, fundraising target or closure saving. The council papers disagree about when reserves would run out; the approved budget and ledger are needed to reconcile them.</p>
<p class="chart-footnote">Sources: {source_link(data, 'school-balances-mar-2026', 'council school balances, Kew row')} · {source_link(data, 'consultation-kew-faq', 'Kew FAQ Q5, page 4')}.</p>
<details class="data-disclosure" id="budget-forecast"><summary>Year-by-year forecast and calculation</summary><div class="disclosure-body"><p>The starting point is a <strong>{money(exact)} revenue reserve on 31 March 2026</strong>. The reserve alone does not establish financial sustainability. FAQ Q5 projects £19,268 left at March 2027; that does not establish cash available today.</p>{indicative}
<p class="data-context"><strong>Calculation:</strong> £231,685 − £212,417 = £19,268; subtracting the next two annual gaps gives −£195,909, then −£457,701. The last figure differs by £1 from the FAQ’s displayed total. The leaflet’s March 2027 exhaustion claim and FAQ Q6’s “now exhausted” wording conflict with Q5. The approved ledger, monthly commitments and forecast assumptions are needed to reconcile them.</p>
</div></details><details class="data-disclosure" id="budget-actuals"><summary>See the financial timeline and five-year history</summary><div class="disclosure-body">{sequence}<p>The revenue reserve fell by {money(fall)} in 2025/26. The council reports revenue and capital balances separately. Income, spending, commitments, support and pupil assumptions are needed to connect these actuals to its projection.</p><p>Annual result means income less expenditure in that financial year. Revenue reserve is the balance carried at year end. These DfE history figures are reported at the source's displayed precision; they are not an annual forecast.</p>{history}<p>Sources: {source_link(data, 'kew-finance-income-history', 'DfE income history')}, {source_link(data, 'kew-finance-expenditure-history', 'expenditure history')} and {source_link(data, 'kew-finance-balance-history', 'balance history')}. For 2025/26 the DfE whole-pound in-year result is −£75,103; the council's precise reserve movement is −£75,103.70, rounded to −£75,104. Their displayed whole-pound figures therefore differ by £1. The approved underlying budget and ledger remain unavailable.</p><p><a href="case-evidence.csv" download="case-evidence.csv">Download these observations and their sources (CSV) ↓</a> · <a href="case-evidence-data.json" download="case-evidence-data.json">Structured observations (JSON)</a></p></div></details>
<details class="data-disclosure" data-overview-detail open id="closure-costs"><summary>What would closure actually save?</summary><div class="disclosure-body"><p>The DfE records a <strong>{money(school_pfi['amountPence'], school_pfi['sourcePrecision'])}</strong> PFI charge in Kew Riverside Primary School's <strong>{e(school_pfi['financialYear'])}</strong> expenditure. That school charge is not the council's entire contract liability or a saving that would automatically follow closure. Which costs would cease, continue or transfer—and what new transition, receiving-school, support or transport costs would arise? The net comparison and Kew-specific contract terms were not in the reviewed public records. {source_link(data, school_pfi['sourceId'], 'DfE expenditure history')} · <a href="options.html#option-5">See the cost audit question</a>.</p></div></details>
<details class="data-disclosure"><summary>A question to use in your response</summary><aside class="reading-note"><p><strong>The missing financial test:</strong> ask for the approved 2026/27 budget, monitoring and annual forecast that reconcile the dated reserve with the council's projected deficit. Also ask for a comparable net cost for each realistic alternative. <a href="proposal.html#questions">Use this in a consultation response</a>.</p></aside></details></section>'''


def render_forecast(data):
    validate(data)
    check = data['forecastCheck']
    revision = data['forecastRevision']
    observations = {item['measure']: item for item in check['observations']}
    total = observations['Reception–Year 6']
    reception = observations['Reception']
    comparison = table('2025/26 Kew planning-area forecast compared with January 2026 census',
                       ['Measure', 'Forecast', 'Actual', 'Actual minus forecast'], [
                           [item['measure'], f'{item["forecastPupils"]:,}', f'{item["actualPupils"]:,}',
                            f'+{item["actualPupils"] - item["forecastPupils"]:,}']
                           for item in check['observations']
                       ])
    changed = revision['laterPupils'] - revision['earlierPupils']
    return f'''
<section class="data-section" id="forecast-checks" aria-labelledby="forecast-title"><p class="eyebrow">02 / Forecast checks</p><h2 id="forecast-title">How reliable are the pupil forecasts?</h2>
<p class="section-lead">One short-term forecast was close overall: <strong>{total['forecastPupils']} pupils forecast, {total['actualPupils']} counted</strong> across the Kew planning area in <strong>{e(check['targetAcademicYear'])}</strong>. Reception was forecast too low: {reception['forecastPupils']} forecast, {reception['actualPupils']} counted.</p>
<span class="data-date">2024/25 SCAP forecast submission · January 2026 census · checked {e(data['checkedOn']['forecasts'])}</span>
<p class="data-context">This checks one forecast vintage and one period across Kew Riverside Primary School, Darell and The King’s, excluding nursery. It is not a Kew Riverside Primary School-only forecast or a test of long-term accuracy.</p>
<p class="chart-footnote">Sources: {source_link(data, check['forecastSourceId'], 'DfE planning-area forecasts')} · {source_link(data, check['actualSourceId'], 'DfE January 2026 school census')}.</p>
<details class="data-disclosure section-detail" data-overview-detail open id="forecast-detail"><summary>See the forecast check and why later figures changed</summary><div class="disclosure-body">{comparison}<p>Planning-area code {e(check['planningAreaCode'])}; “actual minus forecast” is a count, not a percentage error.</p>
<div class="case-subsection"><h3>Why did the later forecast change?</h3><p>For the same Kew planning area and target year <strong>{e(revision['targetAcademicYear'])}</strong>, the {e(revision['earlierPublication'])} projected <strong>{revision['earlierPupils']}</strong> pupils. The {e(revision['laterPublication'])} projected <strong>{revision['laterPupils']}</strong>, an increase of <strong>{changed}</strong>. This forecast revision is not itself a measured forecasting error. Which population, housing, admissions or method assumptions changed? And which version is the proposal and school budget based on? {source_link(data, revision['earlierSourceId'], 'June report')} · {source_link(data, revision['laterSourceId'], 'consultation leaflet')}.</p></div>
<details class="data-disclosure" id="forecast-method"><summary>How this forecast check was calculated</summary><p>The DfE forecast file was filtered to Primary, planning-area code {e(check['planningAreaCode'])} and time period 202526. The January census counts were summed for school URNs {e(', '.join(check['schoolUrns']))}, Reception–Year 6, excluding nursery. Actual minus forecast is +{total['actualPupils'] - total['forecastPupils']} pupils overall and +{reception['actualPupils'] - reception['forecastPupils']} in Reception. With the separate signed error formula (forecast − actual) ÷ actual × 100, these are about {(total['forecastPupils'] - total['actualPupils']) / total['actualPupils'] * 100:.2f}% and {(reception['forecastPupils'] - reception['actualPupils']) / reception['actualPupils'] * 100:.2f}%; a percentage error is not the same measure as the count difference. Longer-horizon, repeated checks remain to be requested.</p></details>
<aside class="reading-note"><p><strong>A useful question for the council:</strong> provide its checks by forecast vintage, horizon and year group, and explain the assumptions behind the revised Kew-area series. <a href="proposal.html#questions">Read the consultation questions</a>.</p></aside></div></details></section>'''


CSV_COLUMNS = ['Observation ID', 'Topic', 'Geography', 'Period', 'Measure', 'Evidence type',
               'Value', 'Comparator', 'Unit', 'Precision', 'Source ID', 'Source URL',
               'Locator', 'Qualification']


def csv_text(data):
    validate(data)
    stream = io.StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\r\n')
    writer.writerow(CSV_COLUMNS)

    def add(obs_id, topic, geography, period, measure, evidence_type, value,
            comparator='', unit='', precision='', source_id='', qualification=''):
        item = source(data, source_id) if source_id else {'url': '', 'locator': ''}
        writer.writerow([obs_id, topic, geography, period, measure, evidence_type,
                         '' if value is None else value, comparator, unit, precision,
                         source_id, item['url'], item['locator'], qualification])

    for row in data['financeHistory']:
        year = row['financialYear']
        for measure, key, sid in [
            ('Total income', 'incomePence', 'kew-finance-income-history'),
            ('Total expenditure', 'expenditurePence', 'kew-finance-expenditure-history'),
            ('In-year result', 'inYearResultPence', 'kew-finance-balance-history'),
            ('Year-end revenue reserve', 'revenueReservePence', 'kew-finance-balance-history'),
        ]:
            add(f'dfe-{year}-{key}', 'financial actuals', 'Kew Riverside Primary School', year,
                measure, 'reported actual', decimal_pounds(row[key]), unit='GBP',
                precision=row['sourcePrecision'], source_id=sid,
                qualification='Financial year ends in March; DfE displayed values retain source precision.')
    council = data['councilRevenueBalance']
    for label, key, period in [
        ('Opening revenue reserve', 'openingPence', council['openingDate']),
        ('Closing revenue reserve', 'closingPence', council['closingDate']),
        ('Revenue reserve movement', 'movementPence', '2025/26'),
    ]:
        add(f'council-{key}', 'financial actuals', 'Kew Riverside Primary School', period,
            label, 'reported actual', decimal_pounds(council[key]), unit='GBP', precision='penny',
            source_id=council['sourceId'], qualification='Revenue balance; capital balance is separate.')
    for statement in data['forecastStatements']:
        add(f'council-forecast-{statement["targetFinancialYear"]}', 'financial projection',
            'Kew Riverside Primary School', statement['targetFinancialYear'], statement['measure'],
            'council projection', None if statement['valuePence'] is None else decimal_pounds(statement['valuePence']),
            comparator=statement['comparison'], unit='GBP', precision='bound or qualitative statement',
            source_id=statement['sourceId'], qualification=statement['reportedWording'] + ('; earlier leaflet wording conflicts with later FAQ Q5 projected £19,268 reserve. Not an approved budget.' if statement['targetFinancialYear'] == '2026/27' else ''))
    for row in data['unavailableBudgetBridge']:
        for label, key in [('Income', 'incomePence'), ('Expenditure', 'expenditurePence'),
                           ('Closing revenue reserve', 'closingRevenueReservePence')]:
            add(f'unavailable-{row["financialYear"]}-{key}', 'missing annual budget',
                'Kew Riverside Primary School', row['financialYear'], label, 'not available',
                row[key], comparator='unknown', unit='GBP',
                qualification='Approved annual budget/ledger unavailable; separate FAQ indicative forecasts are published; blank is not zero.')
    for row in data['indicativeBudgetForecast']:
        for label, key, kind in [('Annual budget gap', 'annualGapPence', 'FAQ indicative forecast'),
                                 ('Year-end position', 'reportedClosingPence', 'FAQ indicative forecast'),
                                 ('Year-end position from rounded inputs', 'calculatedClosingPence', 'calculation')]:
            add(f'faq-{row["financialYear"]}-{key}', 'indicative budget forecast',
                'Kew Riverside Primary School', row['financialYear'], label, kind,
                decimal_pounds(row[key]), unit='GBP', precision='whole pound', source_id=row['sourceId'],
                qualification='FAQ Q5, not approved budget or current cash; rounded calculation differs by £1 in 2028/29.')
    pfi = data['pfiSchoolCharge']
    add('pfi-school-charge-2025-26', 'contextual amount', 'Kew Riverside Primary School',
        pfi['financialYear'], 'School PFI charge', 'reported actual', decimal_pounds(pfi['amountPence']),
        unit='GBP', precision=pfi['sourcePrecision'], source_id=pfi['sourceId'],
        qualification=pfi['status'])
    check = data['forecastCheck']
    for item in check['observations']:
        slug = 'total' if item['measure'] == 'Reception–Year 6' else 'reception'
        scope = f'{check["geography"]} {check["planningAreaCode"]}; URNs {", ".join(check["schoolUrns"])}; nursery excluded'
        for label, key, kind, source_id in [
            ('Forecast pupils', 'forecastPupils', 'published forecast', check['forecastSourceId']),
            ('Actual pupils', 'actualPupils', 'January 2026 census', check['actualSourceId']),
        ]:
            add(f'forecast-check-{slug}-{key}', 'forecast check', scope, check['targetAcademicYear'],
                f'{item["measure"]}: {label}', kind, item[key], unit='pupils', precision='whole pupil',
                source_id=source_id, qualification=f'Forecast vintage: {check["forecastVintage"]}; actual measured {check["actualMeasurementDate"]}.')
        add(f'forecast-check-{slug}-difference', 'forecast check', scope, check['targetAcademicYear'],
            f'{item["measure"]}: actual minus forecast', 'derived difference',
            item['actualPupils'] - item['forecastPupils'], unit='pupils', precision='whole pupil',
            qualification='Calculated from the two separately sourced observations; one vintage and one period.')
    revision = data['forecastRevision']
    for label, key, kind, source_id in [
        ('Earlier projection', 'earlierPupils', revision['earlierPublication'], revision['earlierSourceId']),
        ('Later projection', 'laterPupils', revision['laterPublication'], revision['laterSourceId']),
    ]:
        add(f'forecast-revision-{key}', 'forecast revision', revision['geography'],
            revision['targetAcademicYear'], label, kind, revision[key], unit='pupils',
            precision='whole pupil', source_id=source_id,
            qualification=f'Planning-area code {revision["planningAreaCode"]}; two forecast versions, not a forecast error.')
    add('forecast-revision-difference', 'forecast revision', revision['geography'],
        revision['targetAcademicYear'], 'Later minus earlier', 'derived revision',
        revision['laterPupils'] - revision['earlierPupils'], unit='pupils',
        precision='whole pupil', qualification='Difference between two published forecasts; not measured error.')
    return '\ufeff' + stream.getvalue()
