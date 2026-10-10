"""Render the public comparisons from the reviewed, minimal aggregate dataset.

Run after changes to understand-data.json. --check detects stale HTML/CSV in CI.
Raw national census files remain outside the public repository.
"""
import argparse
import csv
import io
import json
from html import escape
from pathlib import Path
from build_navigation import render_navigation
import re
import build_learning
import build_case_evidence

ROOT = Path(__file__).resolve().parents[2]
K = '133343'
CAPACITY = 'evidence.html#source-school-capacity-may-2025'
CENSUS = 'evidence.html#source-school-census-jan-2026'


def e(value):
    return escape(str(value), quote=True)


def percent(value):
    return ('+' if value > 0 else '−' if value < 0 else '') + f'{abs(value):.1f}%'


def change(values):
    return (values[-1] / values[0] - 1) * 100


def short(school):
    return 'The King’s' if school['urn'] == '102921' else school['shortName']


def featured(school):
    return ' featured' if school['urn'] == K else ''


def table(caption, headers, rows, label):
    return f'<div class="data-table-scroll" role="region" aria-label="{e(label)}; scroll horizontally if needed" tabindex="0"><table><caption>{e(caption)}</caption><thead><tr>' + ''.join(f'<th scope="col">{e(h)}</th>' for h in headers) + '</tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>'


def row(school, values):
    name = e(school['name'])
    phase = school.get('schoolPhaseLabel', 'Mainstream primary phase')
    return f'<tr class="school-data{featured(school)}" data-school="{school["urn"]}"><th scope="row">{name}<span class="phase-label">{e(phase)}</span></th>' + ''.join(f'<td>{e(v)}</td>' for v in values) + '</tr>'


def trend_table(schools, years, caption):
    return table(caption, ['School'] + [y['label'] for y in years] + ['Change'], [row(s, [h['roll'] for h in s['history']] + [percent(change([h['roll'] for h in s['history']]))]) for s in schools], caption)


def trend_chart(school, mode, years):
    values = [h['roll'] for h in school['history']]
    plot = values if mode == 'count' else [(n / values[0] - 1) * 100 for n in values]
    lower, upper = (0, 420) if mode == 'count' else (-50, 25)
    ticks = [0, 210, 420] if mode == 'count' else [-50, -25, 0, 25]
    x = lambda i: 60 + i * 62
    y = lambda n: 161 - (n - lower) / (upper - lower) * 126
    uid = f'trend-{school["urn"]}-{mode}'
    label = 'pupil numbers' if mode == 'count' else 'percentage change in pupil numbers'
    desc = '; '.join(f'{yr["label"]}: {value} pupils' for yr, value in zip(years, values))
    result = f'{values[0]} → {values[-1]} <small>pupils</small>' if mode == 'count' else f'{percent(change(values))} <small>since {years[0]["label"]}</small>'
    svg = f'<svg class="comparison-plot" viewBox="0 0 282 210" role="img" aria-labelledby="{uid}-title {uid}-desc"><title id="{uid}-title">{e(short(school))}: {label}</title><desc id="{uid}-desc">{e(desc)}. Overall change {percent(change(values))}. All charts in this view share the same scale.</desc>'
    for tick in ticks:
        text = str(tick) if mode == 'count' else f'{tick}%'
        svg += f'<line x1="60" x2="246" y1="{y(tick):.2f}" y2="{y(tick):.2f}" class="grid{ " baseline" if tick == 0 else ""}"/><text x="35" y="{y(tick)+4:.2f}" text-anchor="end">{text}</text>'
    svg += '<polyline class="series" points="' + ' '.join(f'{x(i)},{y(n):.2f}' for i, n in enumerate(plot)) + '"/>'
    for i, n in enumerate(plot):
        svg += f'<circle class="point" cx="{x(i)}" cy="{y(n):.2f}" r="4"/>'
        labeltext = str(values[i]) if mode == 'count' else percent(n)
        svg += f'<text class="end-value" x="{x(i)}" y="{y(n)-10:.2f}" text-anchor="middle">{labeltext}</text>'
    for i, yr in enumerate(years):
        svg += f'<text x="{x(i)}" y="189" text-anchor="middle">{e(yr["label"][2:])}</text>'
    svg += '</svg>'
    return f'<figure class="school-chart{featured(school)}" data-school="{school["urn"]}"><h3>{e(short(school))}</h3><p class="chart-result">{result}</p>{svg}<figcaption>May census in each academic year · excludes nursery</figcaption></figure>'


def occupancy(school):
    d = school['capacity2025']
    pct = d['roll'] / d['capacity'] * 100
    return f'<div class="place-row{featured(school)}" data-school="{school["urn"]}"><div><h3>{e(short(school))}</h3><span class="place-total">{d["roll"]} pupils / {d["capacity"]} reported places</span></div><svg viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="{e(short(school))}: {pct:.1f}% occupied; {d["unfilledPlaces"]} unfilled places"><rect class="place-empty" width="100" height="8" rx="2"/><rect class="place-filled" width="{min(100,pct):.4f}" height="8" rx="2"/></svg><div class="place-ratio">{pct:.1f}%<small>{d["unfilledPlaces"]} unfilled</small></div></div>'


def cohorts(school):
    c = school['cohorts2026']
    cells = ''
    for i, n in enumerate(c['counts']):
        band = min(5, n // 15 + 1)
        cells += f'<div class="cohort-cell band-{band}"><span class="year-label">{"Rec" if i == 0 else "Y"+str(i)}</span><strong><span class="sr-only">{e(c["labels"][i])}: </span>{n}</strong></div>'
    return f'<div class="cohort-row{featured(school)}" data-school="{school["urn"]}"><div><h3>{e(short(school))}</h3><p>{c["totalExcludingNursery"]} pupils · Reception–Year 6</p></div><div class="cohort-cells">{cells}</div></div>'


def render(data, case_data=None):
    if case_data is None:
        case_data = json.loads((ROOT / 'case-evidence-data.json').read_text())
    build_case_evidence.validate(case_data)
    schools = data['schools']
    by_urn = {s['urn']: s for s in schools}
    local = [by_urn[u] for u in data['nearbyUrns']]
    allschools = sorted(schools, key=lambda s: s['name'].lower())
    years = data['years']
    kew_cohorts = by_urn[K]['cohorts2026']
    borough_change = change([b['roll'] for b in data['borough']])
    kew_change = change([h['roll'] for h in by_urn[K]['history']])
    charts = ''.join(f'<div class="school-charts" data-trend-view="{mode}"'+(' hidden' if mode=='change' else '')+'>'+''.join(trend_chart(s,mode,years) for s in local)+'</div>' for mode in ['count','change'])
    count_table = trend_table(local,years,'Local pupil numbers · May census, excluding nursery')
    borough_table = trend_table(allschools,years,'Richmond pupil numbers · May census, excluding nursery')
    places_table = table('Richmond school places · May 2025', ['School','Pupils','Capacity','Occupied','Unfilled','Above capacity'], [row(s,[s['capacity2025']['roll'],s['capacity2025']['capacity'],f"{s['capacity2025']['occupancyPercent']:.1f}%",s['capacity2025']['unfilledPlaces'],s['capacity2025']['pupilsOverCapacity']]) for s in allschools], 'Richmond school places')
    cohort_table = table('Richmond year-group counts · January 2026, excluding nursery',['School','Reception','Year 1','Year 2','Year 3','Year 4','Year 5','Year 6','Total'],[row(s,s['cohorts2026']['counts']+[s['cohorts2026']['totalExcludingNursery']]) for s in allschools],'Richmond year-group counts')
    borough_series = ', '.join(f'{y["label"]}: {b["roll"]:,}' for y,b in zip(years,data['borough']))
    revenue_reserve = build_case_evidence.money(case_data['councilRevenueBalance']['closingPence'])
    deficit = case_data['forecastStatements'][1]
    deficit_bound = build_case_evidence.money(deficit['valuePence'], 'whole pound')
    forecast_observations = {item['measure']: item for item in case_data['forecastCheck']['observations']}
    forecast_total = forecast_observations['Reception–Year 6']
    forecast_reception = forecast_observations['Reception']
    body = f'''
<main id="main" class="wrap">
<section class="understand-hero" id="top"><div><p class="eyebrow">Three findings to start with</p><h1>What the numbers tell us.</h1><div class="number-findings" aria-label="Key findings"><article><h2>Kew’s pupil numbers fell faster than the borough’s.</h2><p><strong>{abs(kew_change):.1f}% down at Kew, compared with {abs(borough_change):.1f}% across Richmond’s 45 primary-phase schools</strong>, from May 2022 to May 2025, excluding nursery. The figures show the difference, not its cause: a recovery plan needs to explain what could change locally. <a href="#pupil-trends">Check the pupil figures</a>.</p></article><article><h2>There was a reserve. A later deficit is projected.</h2><p>Kew had a <strong>{revenue_reserve} revenue reserve on 31 March 2026</strong>. The council projects <strong>more than {deficit_bound} accumulated deficit by {e(deficit['targetFinancialYear'])}</strong>. The received final budget summary supports the indicative annual gaps; the ledger, detailed assumptions and current monitoring are still needed. Neither headline establishes long-term viability or the amount needed to keep the school open. <a href="#budget">Check the financial evidence</a>.</p></article><article><h2>The forecast was close overall, but too low for Reception.</h2><p>For <strong>{e(case_data['forecastCheck']['targetAcademicYear'])}</strong>, the Kew-area forecast was <strong>{forecast_total['forecastPupils']} pupils; January 2026 counted {forecast_total['actualPupils']}</strong>. Reception was <strong>{forecast_reception['forecastPupils']} forecast, {forecast_reception['actualPupils']} counted</strong>. This is one period across three schools, excluding nursery—not a forecast for Kew Riverside Primary School alone or a long-term accuracy test. Later forecasts still need checking. <a href="#forecast-checks">Check the forecast evidence</a>.</p></article></div><p class="source-note">School comparisons checked 22 September 2026 · finance updated 8 October; historical comparisons checked September 2026</p></div><nav class="visual-route" aria-label="Explore the comparisons"><p>Explore a finding or another question</p><a href="#pupil-trends">Pupil numbers</a><a href="#forecast-checks">Forecast reliability</a><a href="#school-places">Unfilled places</a><a href="#year-groups">Year-group sizes</a><a href="#budget">School finances</a><a href="#other-proposals">Other local proposals</a><a href="#learning-and-results">Learning and results</a><a href="#methodology">Sources and method</a></nav></section>
<section class="data-section" id="pupil-trends" aria-labelledby="trends-title"><p class="eyebrow">01 / Pupil trends</p><h2 id="trends-title">Is Kew Riverside Primary School’s decline unusual?</h2><p class="section-lead">Kew Riverside Primary School’s pupil numbers fell faster than the borough’s: <strong>{abs(kew_change):.1f}%</strong>, compared with <strong>{abs(borough_change):.1f}% across Richmond’s 45 primary-phase schools</strong>.</p><span class="data-date">May 2022 → May 2025 · reported pupils</span><p class="data-context">Four May census snapshots, excluding nursery. These show how pupil numbers changed, not why. <a href="{CAPACITY}">Source: DfE school capacity data</a>.</p><details class="data-disclosure section-detail" data-overview-detail open id="pupil-trends-detail"><summary>Compare the pupil charts and data</summary><div class="disclosure-body"><p class="data-context">The three schools shown are in the Kew planning area. The King’s was formerly The Queen’s. Choosing the whole planning area keeps the comparison consistent; different admissions arrangements and circumstances still matter.</p>
<div class="data-controls" role="group" aria-label="Pupil trend measure" hidden><button type="button" data-measure="count" aria-pressed="true">Pupil numbers</button><button type="button" data-measure="change" aria-pressed="false">Percentage change</button></div><p id="trend-status" class="trend-status" role="status" aria-live="polite">Pupil numbers · the same scale for each school.</p>
{charts}
<p class="chart-footnote">Source: <a href="{CAPACITY}">DfE school capacity dataset</a>. Four May census snapshots; nursery excluded. These figures use a different series from the <a href="evidence.html#evidence">council leaflet’s reported and forecast rolls</a>. The lines do not explain why pupil numbers changed.</p>
<details class="data-disclosure"><summary>View the local trend data</summary>{count_table}<p>Change = (last year ÷ first year − 1) × 100, rounded to one decimal place. A flat percentage line can still represent a different school size.</p></details>
<details class="data-disclosure"><summary>Compare all Richmond primary schools</summary><p>Includes separate infant and junior schools. Compare each school’s change over time with care: they serve different age ranges and communities. Schools are alphabetical, with Kew Riverside Primary School highlighted.</p>{borough_table}<p><strong>Borough totals:</strong> {borough_series}. The {abs(borough_change):.1f}% fall is the change in the combined pupil total, not the average school’s percentage change.</p></details>
<aside class="reading-note"><p><strong>A useful question for the council:</strong> what explains the differences within Kew, and which measures could realistically change Kew Riverside Primary School’s future intake?</p><p>For the longer borough context, see <a href="evidence.html#borough-context">Richmond’s Reception applications and capacity figures</a>. Applications are not the same as pupils already at school.</p></aside></div></details></section>
{build_case_evidence.render_forecast(case_data)}
<section class="data-section" id="school-places" aria-labelledby="places-title"><p class="eyebrow">03 / School places</p><h2 id="places-title">Where are the unfilled places?</h2><p class="section-lead">Kew Riverside Primary School and Darell both had a lot of unfilled capacity in this snapshot. The King’s was much closer to its reported capacity.</p><span class="data-date">May 2025 pupils + 1 May 2025 capacity</span><p class="data-context"><strong>Unfilled capacity is not a current vacancy list or a promise of admission.</strong> It does not show staffed places by year group or specialist support capacity. <a href="{CAPACITY}">Source: DfE school capacity data</a>.</p><details class="data-disclosure section-detail" data-overview-detail open id="school-places-detail"><summary>Compare school capacity and unfilled places</summary><div class="disclosure-body"><div class="places-key" aria-label="Capacity chart legend"><span><i aria-hidden="true"></i>Pupils on roll</span><span><i class="empty-key" aria-hidden="true"></i>Unfilled reported capacity</span></div><div class="place-list">{''.join(occupancy(s) for s in local)}</div>
<p class="chart-footnote">Source: <a href="{CAPACITY}">DfE school capacity dataset</a>. Each bar represents 100% of that school’s own capacity; the numbers show that the schools differ in size. <strong>Unfilled capacity is not a current vacancy list or a promise of admission.</strong> It does not establish how many staffed places exist in each year group. Capacity in SEN units and resourced provision is reported separately, so these bars cannot establish specialist support capacity.</p>
<details class="data-disclosure"><summary>Why can different reports give different occupancy rates?</summary><p>Capacity is the number of school places. An admission number is how many pupils normally enter a particular year. A temporary cut to the intake can change the capacity used in a council planning calculation.</p><p>This chart uses the DfE’s published whole-school capacity for a matched date. It does not substitute a reduced admission number or the newer January 2026 pupil count. See the <a href="evidence.html#borough-context">borough capacity explanation</a> for the council’s separate permanent and temporarily reduced measures.</p></details>
<details class="data-disclosure"><summary>Compare all Richmond primary schools</summary><p>Some schools have more pupils than reported capacity. Occupancy can therefore exceed 100%; “above capacity” is shown separately from unfilled places. Infant and junior schools have different age ranges.</p>{places_table}</details>
<aside class="reading-note"><p><strong>A useful question for the council:</strong> how do these physical capacity figures translate into places by year group, staffing and the support each child would need?</p><p>The Kew consultation offers current pupils a Darell place if closure proceeds. <a href="proposal.html#questions">Read the transition commitments and remaining questions</a>.</p></aside></div></details></section>
<section class="data-section" id="year-groups" aria-labelledby="cohorts-title"><p class="eyebrow">04 / Year groups</p><h2 id="cohorts-title">What sits behind the total?</h2><p class="section-lead">In January 2026, Kew Riverside Primary School had <strong>{kew_cohorts["totalExcludingNursery"]} pupils</strong> from Reception to Year 6. Its year groups ranged from <strong>{min(kew_cohorts["counts"])} to {max(kew_cohorts["counts"])}</strong> pupils.</p><span class="data-date">January 2026 census · pupils by curriculum year</span><p class="data-context">A year group is not necessarily a separate class. <strong>This is not the September 2026 roll</strong>, or the council’s separate 2026/27 forecast of 84. <a href="{CENSUS}">Source: DfE school census</a>.</p><details class="data-disclosure section-detail" data-overview-detail open id="year-groups-detail"><summary>Compare year-group sizes and data</summary><div class="disclosure-body"><p class="data-context">Read across each school. Darker shading means more pupils, using the same bands for all three schools. Each number is a year group, not necessarily a separate class.</p><div class="cohort-list">{''.join(cohorts(s) for s in local)}</div><div class="cohort-key" aria-label="Colour bands: 0 to 14, 15 to 29, 30 to 44, 45 to 59, 60 or more pupils"><span>Fewer pupils</span><i class="band-1" aria-hidden="true"></i><i class="band-2" aria-hidden="true"></i><i class="band-3" aria-hidden="true"></i><i class="band-4" aria-hidden="true"></i><i class="band-5" aria-hidden="true"></i><span>More pupils</span></div>
<p class="chart-footnote">Source: <a href="{CENSUS}">DfE January 2026 school census</a>. Full-time and part-time pupil headcounts are added within each year group; nursery is excluded. <strong>This is not the September 2026 roll.</strong> The January count of 84 is separate from the council leaflet’s 2026/27 forecast of 84.</p>
<details class="data-disclosure"><summary>Compare all Richmond primary schools</summary><p>Reception–Year 6 only. At separate infant or junior schools, a zero may mean that year is not offered; it must not be read as an empty class. Public counts are shown as published or summed from published counts; no suppressed values have been estimated.</p>{cohort_table}</details>
<aside class="reading-note"><p><strong>A useful question for the school and council:</strong> what have the September 2026 intake and in-year admissions changed? And what would a realistic recruitment plan achieve over several years?</p><p>For example, Kew’s January Reception group had {kew_cohorts["counts"][0]} pupils and Year 6 had {kew_cohorts["counts"][-1]}. That single comparison cannot predict the next total: the next intake and pupils joining or leaving also matter. <a href="options.html#option-enrolment">Explore the school-awareness campaign idea</a>.</p></aside></div></details></section>
{build_case_evidence.render_budget(case_data)}
<section class="data-section" id="other-proposals" aria-labelledby="proposals-title"><p class="eyebrow">06 / Different proposals, different circumstances</p><h2 id="proposals-title">What is Richmond considering elsewhere?</h2><p class="section-lead">The council proposes closing Kew Riverside Primary School and amalgamating two schools in Hampton Wick. Both are proposals for September 2027; neither is a final decision.</p><p class="data-context">An amalgamation elsewhere does not establish that it would work at Kew or preserve teaching on its site. Sources checked 22 September 2026: <a href="evidence.html#source-consultation-leaflet">Kew leaflet</a> · <a href="evidence.html#source-hampton-wick-proposal-2026">Hampton Wick / St John leaflet</a>.</p><details class="data-disclosure section-detail" data-overview-detail open id="other-proposals-detail"><summary>Compare the two proposals</summary><div class="disclosure-body"><div class="proposal-comparison"><article><span class="proposal-type">Proposed closure</span><h3>Kew Riverside Primary School</h3><p>Close the school at the end of 2026/27, effective 1 September 2027. The council offers every current pupil a place at Darell, with other schools subject to availability.</p><p>The leaflet explains why options such as a smaller intake, shared leadership, amalgamation and academy arrangements were not preferred.</p><a href="proposal.html">Read the Kew proposal and questions →</a></article><article><span class="proposal-type">Proposed amalgamation</span><h3>Hampton Wick Infant &amp; Nursery + St John the Baptist Junior</h3><p>Bring the two schools together into a 210-place primary school, keeping nursery provision. At first it would run across both buildings; the longer-term aim is a single site.</p><p>The legal route would close one school and extend the other’s age range. Which school closes, the resulting school’s status and the eventual site remain to be determined.</p><a href="https://www.richmond.gov.uk/media/zaxlziiv/hampton_wick_st_john_the_baptist_consultation_leaflet.pdf">Read the council’s amalgamation leaflet ↗&#xFE0E;</a></article></div><p class="chart-footnote">Sources checked 22 September 2026: <a href="evidence.html#source-organisation-overview-2026">council consultation overview</a>; <a href="evidence.html#source-hampton-wick-proposal-2026">Hampton Wick / St John leaflet, PDF pages 7–10</a>; <a href="evidence.html#source-consultation-leaflet">Kew leaflet</a>.</p><aside class="reading-note"><p><strong>The comparison opens a question, not a conclusion.</strong> A merger being considered elsewhere does not establish that it would work at Kew or preserve teaching on its site. A fair assessment needs comparable costs, pupil demand, governance and delivery partners.</p><p><a href="proposal.html#questions">See the questions about costed alternatives</a> · <a href="proposal.html#timetable">Follow the decision timetable</a></p></aside></div></details></section>
{build_learning.render(json.loads((ROOT / "attainment-data.json").read_text()))}
<section class="data-method" id="methodology" aria-labelledby="method-title"><p class="eyebrow">Sources and method</p><h2 id="method-title">Keep the comparisons fair.</h2><p>The dates and measures differ. These comparisons cannot show causes, whether places are available now, or how many pupils are needed for financial viability.</p><details class="data-disclosure" id="comparison-method"><summary>How these comparisons were made</summary><ul><li><strong>Dates stay separate.</strong> May school-roll histories, May 2025 capacity and January 2026 year groups answer different questions. None is a live September headcount.</li><li><strong>Comparable scope.</strong> The borough tables cover 45 mainstream state-funded primary-phase schools, including infant and junior schools, with nursery excluded. They are not a ranking of school quality. Capacity excludes places in SEN units and resourced provision; those are reported separately.</li><li><strong>Local selection.</strong> Kew Riverside Primary School, Darell and The King’s are the three schools in Kew planning area 3180007 in the capacity dataset. The King’s name is used in the latest records; older documents call it The Queen’s.</li><li><strong>Reorganisations and sites.</strong> School histories follow the stable school establishment identifier where three schools changed their unique reference number. Thomson House’s two site records are added into one school total. All 45 schools have four years of data.</li><li><strong>Calculated figures.</strong> Occupancy = pupils ÷ reported capacity × 100. Trend change = (last roll ÷ first roll − 1) × 100. Percentages are rounded to one decimal; totals are calculated from unrounded counts.</li><li><strong>Limits.</strong> These charts cannot show causes, whether places are available now or how many pupils are needed for financial viability. Funding and housing scenarios need more verified evidence.</li></ul></details><p><a class="text-link" href="richmond-schools.csv" download="richmond-schools.csv">Download the chart data (CSV) ↓</a></p><p>Spreadsheet download includes the values, measurement dates and source links. <a href="understand-data.json">Structured data and provenance (JSON)</a> · <a href="corrections.html">Report a correction privately</a>.</p><p>Contains Department for Education information licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>. Analysis and questions are this parent-led site’s editorial work.</p></section>
<section class="data-next"><div><h2>Use the evidence in your response.</h2><p>Explain what matters to your family, point to a dated source and ask a specific question. Community letters here are separate from the official consultation.</p></div><a class="button primary" href="response-checklist.pdf">Response checklist (PDF) ↓</a></section>
</main>'''
    index = (ROOT / 'index.html').read_text()
    header = index[index.index('<body'):index.index('<main')]
    # Share navigation without inheriting homepage-specific layout classes.
    header = re.sub(r'<body\b[^>]*>', '<body>', header, count=1)
    header = header.replace('href="#top"','href="index.html"').replace('href="#records"','href="evidence.html#records"')
    header = header.replace('href="understand.html"','href="understand.html" aria-current="page"')
    footer = index[index.index('<footer>'):]
    csp = re.search(r'<meta http-equiv="Content-Security-Policy"[^>]+>',index).group(0)
    head = f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">{csp}
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="theme-color" content="#143936">
<title>Understand the situation | Kew Riverside Primary School &amp; Richmond school data</title><meta name="description" content="Explore dated pupil trends, forecast checks, school finances, places and learning results for Kew Riverside Primary School and Richmond schools."><meta property="og:title" content="Understand the situation · Kew Riverside Primary School"><meta property="og:description" content="Dated, sourced answers on pupil numbers, forecasts, school finances, places and learning results."><meta property="og:type" content="website"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="styles.css?v=2026092303"><link rel="stylesheet" href="participation.css?v=2026092303"><link rel="stylesheet" href="discovery.css?v=2026092303"><link rel="stylesheet" href="parent-plan.css?v=2026100802"><link rel="stylesheet" href="button-motion.css"><link rel="stylesheet" href="understand.css?v=2026092402"><script src="navigation.js?v=2026092202" defer></script><script src="understand.js?v=2026092401" defer></script><link rel="stylesheet" href="analytics.css?v=2026101001"><script src="analytics.js?v=2026101001" defer></script><link rel="stylesheet" href="voice.css?v=2026100802"><script src="voice.js?v=2026092301" defer></script><link rel="stylesheet" href="theme.css?v=2026092701"><script src="theme.js?v=2026092201"></script></head>
'''
    return render_navigation('understand.html', head + header + body + footer)


def csv_text(data):
    stream = io.StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\r\n')
    writer.writerow(['School','Current URN','School establishment number','Measure','Measurement date','Academic year','Year group','Value','Unit','Source URL'])
    for s in data['schools']:
        prefix = [s['name'],s['urn'],s['laestab']]
        for y,h in zip(data['years'],s['history']):
            for measure,key,unit in [('Pupils excluding nursery','roll','pupils'),('Reported capacity excluding nursery','capacity','places')]:
                writer.writerow(prefix+[measure,y['censusMonth'],y['label'],'',h[key],unit,data['sources'][0]['url']])
        for label,n in zip(s['cohorts2026']['labels'],s['cohorts2026']['counts']):
            writer.writerow(prefix+['Pupils by curriculum year','2026-01','2025/26',label,n,'pupils',data['sources'][1]['url']])
    return '\ufeff'+stream.getvalue()


def outputs():
    data = json.loads((ROOT/'understand-data.json').read_text())
    case_data = json.loads((ROOT/'case-evidence-data.json').read_text())
    return {'understand.html':render(data, case_data),'richmond-schools.csv':csv_text(data), 'attainment.csv':build_learning.csv_text(json.loads((ROOT/'attainment-data.json').read_text())), 'case-evidence.csv':build_case_evidence.csv_text(case_data)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name,text in outputs().items():
        path=ROOT/name
        if args.check:
            if not path.exists() or path.read_bytes() != text.encode('utf-8'):
                raise SystemExit(f'{name} is stale; run python3 .github/scripts/build_understand.py')
        else:
            path.write_bytes(text.encode('utf-8'))
    print('Comparison HTML and CSV match the reviewed data.' if args.check else 'Rendered comparison HTML and CSV.')
