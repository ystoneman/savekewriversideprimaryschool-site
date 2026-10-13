"""Check published links, shared navigation and source-download consistency."""
from collections import Counter
import csv
from html.parser import HTMLParser
import json
import re
import posixpath
import struct
import unittest
from urllib.parse import parse_qs, unquote, urlsplit

from check_site import PUBLIC_FILES, REDIRECT_PAGES, ROOT, ARCHIVED_PAGES, ARCHIVED_LINK_EXEMPTIONS, archived_links


# Snapshot of the moved homepage IDs before the September 2026 page split.
# Keep this independent of the new pages: deleting an entry must fail the check,
# even if no current page still links to that previously shared address.
LEGACY_EVIDENCE_IDS = '''
evidence visual-preview-title school-roll-title roll-svg-title roll-svg-desc
borough-context trend-title trend-desc area-fill timeline earlier-record records
record-filters record-search topic-filter year-filter type-filter status-filter
result-count research-count clear-filters source-lessons-report source-grid
source-organisation-overview-2026 source-school-census-jan-2026
source-school-capacity-may-2025 source-hampton-wick-proposal-2026
source-consultation-richmond source-inspection-2026 source-newsletter-2026
source-committee-september-2026 source-guidance-index source-guidance-2026
source-participation source-buildings-2026 source-planning-nov-2025
source-committee-nov-2025 source-forum-july-2025 source-planning-july-2025
source-committee-june-2025 source-forum-2024 source-planning-2024 source-strategy-2023
source-inspection-2021 source-inspection-2017 source-inspection-2012
source-assessment-2011 source-visit-2009 source-inspection-2007 source-inspection-2003
source-school-home source-pfi source-school-finance source-benchmarking
source-ofsted-index source-newsletter-index source-committee-index
source-committee-meetings source-forum-index source-petitions source-petition-scheme
source-gias source-consultation-afc source-consultation-leaflet
source-consultation-faq source-consultation-response source-committee-remit
source-committee-chair source-committee-vice-chair source-committee-november-2026
no-results gaps method
'''.split()
LEGACY_OPTION_IDS = '''
options option-recovery-plan option-crowdfunding crowdfunding-funding-needed
crowdfunding-council-assessment crowdfunding-sustainability crowdfunding-recipient
crowdfunding-outreach crowdfunding-examples crowdfunding-appeal-terms
crowdfunding-expertise option-demand option-enrolment
'''.split()


class Document(HTMLParser):
    VOID_TAGS = frozenset('area base br col embed hr img input link meta param source track wbr'.split())

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.references = []
        self.metadata = []
        self.scripts = []
        self.refreshes = []
        self.navigation = {name: [] for name in ('desktop-explore', 'mobile-menu', 'participation-nav')}
        self.source_ids = []
        self.source_cards = {}
        self.legacy_routes = {}
        self.legacy_links = {}
        self.stack = []
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'meta':
            self.metadata.append(attrs)
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
            self.refreshes.append(attrs.get('content', ''))
        classes = set(attrs.get('class', '').split())
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for attribute in ('href', 'src'):
            if attribute in attrs:
                self.references.append((tag, attribute, attrs[attribute]))
        if tag == 'script' and 'src' in attrs:
            self.scripts.append(attrs['src'])
        if 'source-card' in classes:
            self.source_ids.append(attrs.get('id', ''))
            self.source_cards[attrs.get('id', '')] = {'attrs': attrs, 'summary': [], 'url': None}
        elif tag == 'a' and self.stack and self.stack[-1][0] == 'h3':
            card = next((ancestor_attrs.get('id') for _, ancestor_classes, ancestor_attrs in reversed(self.stack)
                         if 'source-card' in ancestor_classes), None)
            if card:
                self.source_cards[card]['url'] = attrs.get('href')
        if 'legacy-route' in classes:
            self.legacy_routes[attrs.get('id', '')] = attrs.get('data-destination', '')
        if tag == 'a' and 'href' in attrs:
            for name in self.navigation:
                if any(name in ancestor_classes for _, ancestor_classes, _ in self.stack):
                    self.navigation[name].append(attrs['href'])
            for _, ancestor_classes, ancestor_attrs in self.stack:
                if 'legacy-route' in ancestor_classes:
                    self.legacy_links.setdefault(ancestor_attrs.get('id', ''), []).append(attrs['href'])
        if tag not in self.VOID_TAGS:
            self.stack.append((tag, classes, attrs))

    def handle_data(self, data):
        if len(self.stack) < 2:
            return
        tag, classes, _ = self.stack[-1]
        parent_tag, parent_classes, parent_attrs = self.stack[-2]
        if tag == 'p' and parent_tag == 'article' and 'source-card' in parent_classes and 'publisher' not in classes:
            self.source_cards[parent_attrs['id']]['summary'].append(data)

    def handle_startendtag(self, tag, attributes):
        self.handle_starttag(tag, attributes)
        if tag not in self.VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break


def local_destination(page, reference):
    """Resolve relative project-site URLs without treating a query as a filename."""
    url = urlsplit(reference)
    if url.scheme or url.netloc:
        return None
    path = unquote(url.path)
    filename = posixpath.normpath(posixpath.join(posixpath.dirname(page), path)) if path else page
    if path.endswith('/'):
        filename = posixpath.join(filename, 'index.html')
    return filename, unquote(url.fragment)


def navigation_destinations(page, references):
    # The homepage's #top and other pages' index.html both mean "Home".
    return {(filename, '' if fragment == 'top' else fragment)
            for filename, fragment in (local_destination(page, ref) for ref in references)}


class SiteStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = {name: Document((ROOT / name).read_text(encoding='utf-8'))
                     for name in sorted(PUBLIC_FILES) if name.endswith('.html')}

    def test_campaign_publisher_identity_survives_all_page_builders(self):
        from build_navigation import render_navigation
        expected = 'Save Kew Riverside Primary School Campaign'
        base = 'https://savekewriversideprimaryschool.org/'
        for name, page in self.pages.items():
            if name in REDIRECT_PAGES:
                continue
            with self.subTest(page=name):
                document = (ROOT / name).read_text()
                metadata = {a.get('property', a.get('name')): a.get('content') for a in page.metadata if 'itemprop' not in a}
                self.assertEqual(metadata['og:site_name'], expected)
                self.assertEqual(metadata['og:url'], base + ('' if name == 'index.html' else name))
                self.assertIn('Independent parent-led campaign.', metadata['description'])
                if name in ('lessons.html', 'lessons-sources.html', 'understand.html'):
                    self.assertEqual(metadata['og:description'], metadata['description'])
                self.assertIn('aria-label="'+expected+' home"', document)
                self.assertIn('<strong>CAMPAIGN</strong>', document)
                self.assertEqual(render_navigation(name, document), document, 'Regeneration must retain campaign identity')
        self.assertIn('<title>Community letters | '+expected+'</title>', (ROOT / 'letters.html').read_text())
        self.assertIn('itemtype="https://schema.org/WebSite"', (ROOT / 'index.html').read_text())
        self.assertIn(('a', 'href', 'about.html#press'), self.pages['letters.html'].references)

    def test_local_links_resources_and_fragments_resolve(self):
        for name, page in self.pages.items():
            for tag, attribute, reference in page.references:
                with self.subTest(page=name, element=tag, attribute=attribute, reference=reference):
                    destination = local_destination(name, reference)
                    if destination is None:
                        continue  # External availability is not a local CI dependency.
                    filename, fragment = destination
                    self.assertIn(filename, PUBLIC_FILES, 'Link/resource is outside the published asset list')
                    self.assertTrue((ROOT / filename).is_file(), 'Linked public file is missing')
                    if fragment and filename in self.pages:
                        self.assertIn(fragment, self.pages[filename].ids, 'The destination anchor does not exist')

    def test_document_ids_are_unique(self):
        for name, page in self.pages.items():
            with self.subTest(page=name):
                duplicates = [identifier for identifier, count in Counter(page.ids).items() if count > 1]
                self.assertEqual(duplicates, [], 'Duplicate IDs make anchors and controls ambiguous')

    def test_external_link_arrows_render_as_text_on_iphone(self):
        # iOS Safari draws a bare U+2197 as a blue emoji square. The text-presentation
        # selector U+FE0E keeps the plain arrow; the builders must emit it too.
        for name in sorted(PUBLIC_FILES):
            if not name.endswith(('.html', '.js')):
                continue
            text = (ROOT / name).read_text(encoding='utf-8')
            bare = text.replace('↗&#xFE0E;', '').replace('↗︎', '').count('↗')
            with self.subTest(file=name):
                self.assertEqual(bare, 0, 'Follow each ↗ with &#xFE0E; so iPhones do not show an emoji')

    def test_previously_shared_homepage_anchors_keep_explicit_fallbacks(self):
        expected = {identifier: filename + '#' + identifier
                    for filename, identifiers in (('evidence.html', LEGACY_EVIDENCE_IDS),
                                                   ('options.html', LEGACY_OPTION_IDS))
                    for identifier in identifiers}
        homepage = self.pages['index.html']
        for identifier, destination in expected.items():
            with self.subTest(anchor=identifier):
                self.assertEqual(homepage.legacy_routes.get(identifier), destination,
                                 'A previously shared homepage URL lost its destination')
                self.assertIn(destination, homepage.legacy_links.get(identifier, []),
                              'Legacy destinations need usable links without JavaScript')
                filename, fragment = local_destination('index.html', destination)
                self.assertIn(fragment, self.pages[filename].ids,
                              'A legacy route must reach the original named content')

    def test_fundraising_briefs_are_public_direct_links_without_incoming_routes(self):
        briefs = {'fundraising-trustees.html', 'fundraising-admin.html'}
        self.assertTrue(briefs <= PUBLIC_FILES)
        for name, page in self.pages.items():
            text = (ROOT / name).read_text()
            # A self-canonical <link> is metadata, not an incoming visitor link.
            for tag, attribute, reference in page.references:
                if tag == 'a' and attribute == 'href':
                    self.assertNotIn(posixpath.basename(unquote(urlsplit(reference).path)), briefs,
                                     'Role briefs must not be linked from public pages')
            if name in briefs:
                self.assertIn('name="robots" content="noindex,nofollow"', text)
                self.assertNotIn('<form', text)
                self.assertNotRegex(text, r'fundraising(?:-checklist)?\.html|output/pdf|127\.0\.0\.1|local preview')
        self.assertNotIn('fundraising.html', PUBLIC_FILES)
        self.assertNotIn('fundraising-checklist.html', PUBLIC_FILES)

    def test_brief_previews_have_distinct_public_images_and_proposal_context(self):
        base = 'https://savekewriversideprimaryschool.org/'
        images = set()
        for role in ('trustees', 'admin'):
            name = f'fundraising-{role}.html'
            page = self.pages[name]
            meta = {a.get('property', a.get('name')): a.get('content') for a in page.metadata}
            self.assertEqual(meta['og:url'], base + name)
            self.assertEqual(meta['og:type'], 'website')
            self.assertEqual(meta['og:locale'], 'en_GB')
            self.assertEqual(meta['twitter:card'], 'summary_large_image')
            self.assertEqual(meta['twitter:image'], meta['og:image'])
            self.assertEqual(meta['twitter:title'], meta['og:title'])
            self.assertEqual(meta['description'], meta['og:description'])
            self.assertIn('donations are not open', meta['og:description'].lower())
            self.assertIn('proposal' if role == 'trustees' else 'approval pending', meta['og:description'].lower())
            self.assertIn('trustee' if role == 'trustees' else 'account', meta['og:title'].lower())
            self.assertTrue(meta['og:image:alt'])
            self.assertIn(('link', 'href', base + name), page.references)
            image_url = meta['og:image']
            self.assertTrue(image_url.startswith(base))
            filename = urlsplit(image_url).path.removeprefix(urlsplit(base).path)
            self.assertIn(filename, PUBLIC_FILES)
            data = (ROOT / filename).read_bytes()
            self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
            self.assertEqual(struct.unpack('>II', data[16:24]), (1200, 630))
            self.assertLess(len(data), 300_000)
            self.assertEqual((meta['og:image:width'], meta['og:image:height'], meta['og:image:type']), ('1200', '630', 'image/png'))
            images.add(filename)
        self.assertEqual(len(images), 2, 'The recipient roles need distinct preview images')

    def test_every_page_uses_the_same_versioned_navigation_script(self):
        baseline = [src for src in self.pages['index.html'].scripts if urlsplit(src).path == 'navigation.js']
        self.assertEqual(len(baseline), 1)
        self.assertTrue(parse_qs(urlsplit(baseline[0]).query).get('v'), 'Navigation fixes need a cache version')
        for name, page in self.pages.items():
            if name in REDIRECT_PAGES:
                continue  # Automatic handoff; covered by the redirect journey tests.
            with self.subTest(page=name):
                actual = [src for src in page.scripts if urlsplit(src).path == 'navigation.js']
                self.assertEqual(actual, baseline, 'Pages must load the same navigation release exactly once')

    def test_public_content_footers_expose_parent_youtube_and_open_days(self):
        for name in sorted(name for name in PUBLIC_FILES if name.endswith('.html') and name not in REDIRECT_PAGES):
            with self.subTest(page=name):
                document = (ROOT/name).read_text()
                row = re.search(r'<!-- footer-discovery:start -->(.*?)<!-- footer-discovery:end -->', document, re.S)
                self.assertIsNotNone(row)
                self.assertIn('href="https://www.youtube.com/@KewParentVoices"',row.group())
                self.assertIn('Parent Voices on YouTube',row.group())
                self.assertIn('<svg',row.group())
                self.assertIn('href="https://docs.google.com/forms/d/e/1FAIpQLSfwTdpsQB5HOlbJxumjINzFjWiZZCshEHUIrkgXlUDCBBPGrw/viewform"',row.group())
                self.assertIn('Visit our Open Days',row.group())
                self.assertNotIn('petition',row.group())

    def test_shared_navigation_destinations_stay_consistent(self):
        # The slim campaign site (owner decision, 13 October 2026): one five-page
        # Menu on every page, a single Get involved shortcut and live-only footers.
        baseline = self.pages['about.html'].navigation
        expected_menu = [local_destination('about.html', href) for href in baseline['mobile-menu']]
        self.assertEqual(expected_menu, [('index.html', ''), ('dates.html', ''), ('get-involved.html', ''), ('updates.html', ''), ('about.html', ''),
                                         ('videos.html', 'watch-parent-voices'), ('visit/index.html', '')])
        expected_desktop = navigation_destinations('about.html', baseline['desktop-explore'])
        self.assertEqual(expected_desktop, {('get-involved.html', '')})
        live_footer = {'about.html', 'dates.html', 'get-involved.html', 'updates.html', 'letters.html', 'videos.html', 'feedback.html', 'corrections.html', 'privacy.html'}
        for name, page in self.pages.items():
            if name in REDIRECT_PAGES:
                continue
            with self.subTest(page=name):
                menu_routes = [local_destination(name, href) for href in page.navigation['mobile-menu']]
                expected = expected_menu[:5] + [('sent.html', '')] + expected_menu[5:] if name == 'sent.html' else expected_menu
                self.assertEqual(menu_routes, expected,
                                 'Every page shows the same Menu entries in the same order')
                self.assertEqual(page.navigation['participation-nav'], [], 'The header participation tiles were retired')
                text = (ROOT / name).read_text()
                footer = re.search(r'<footer>.*?</footer>', text, re.S)
                self.assertIsNotNone(footer, 'Pages with the shared shell keep a footer')
                footer_pages = {local_destination(name, href)[0] for href in re.findall(r'href="([^"]+)"', footer.group()) if local_destination(name, href)}
                self.assertTrue(live_footer <= footer_pages, 'Every footer keeps the live campaign and task pages')
                self.assertFalse(footer_pages & ARCHIVED_PAGES, 'Footers link only to live pages')
                if name == 'index.html':
                    self.assertIn('data-home-landing', text)
                    self.assertEqual(navigation_destinations(name, page.navigation['mobile-menu']),
                                     navigation_destinations(name, page.navigation['desktop-explore']), 'Home uses the complete Menu at every width')
                    continue
                self.assertEqual(navigation_destinations(name, page.navigation['desktop-explore']), expected_desktop, 'Desktop destinations differ between pages')

    def test_archived_pages_are_marked_and_unlinked_from_live_pages(self):
        # Archived pages stay served for old links but carry a banner and noindex,
        # and no live page links to them outside hidden homepage legacy routes.
        self.assertEqual(ARCHIVED_PAGES, {'proposal.html', 'faq.html', 'understand.html', 'evidence.html', 'options.html', 'lessons.html',
                                          'lessons-sources.html', 'rally.html', 'supporters.html', 'fundraising-trustees.html', 'fundraising-admin.html'})
        self.assertTrue(ARCHIVED_PAGES <= PUBLIC_FILES, 'Archived pages must stay published for old links')
        for name in sorted(n for n in PUBLIC_FILES if n.endswith('.html') and n not in REDIRECT_PAGES):
            text = (ROOT / name).read_text()
            with self.subTest(page=name):
                robots = re.search(r'<meta name="robots" content="([^"]*)"', text)
                if name in ARCHIVED_PAGES:
                    main = text.split('<main', 1)[1].split('>', 1)[1]
                    self.assertTrue(main.startswith('<!-- archive:start --><aside class="archive-banner"'), 'Banner is the first thing in <main>')
                    banner = main.split('<!-- archive:end -->', 1)[0]
                    self.assertIn('Archived 13 October 2026.', banner)
                    self.assertIn('<a href="dates.html">Current dates</a>', banner)
                    self.assertIn('<a href="get-involved.html">Get involved</a>', banner)
                    self.assertIn('<span class="archive-flag">Archived</span>', text, 'Deep-link arrivals see the sticky archive label')
                    self.assertNotIn('mobile-page-note', text, 'Dated status notes would contradict the archive banner')
                    self.assertTrue(robots and 'noindex' in robots.group(1))
                else:
                    self.assertNotIn('archive-banner', text)
                    self.assertEqual(archived_links(name, text), set(), 'Live pages must not link to archived pages')
        self.assertEqual(ARCHIVED_LINK_EXEMPTIONS, {('privacy.html', 'proposal.html#who-decides')})
        self.assertIn('href="proposal.html#who-decides"', (ROOT / 'privacy.html').read_text())
        # A planted link on a live page is caught.
        self.assertEqual(archived_links('dates.html', '<a href="faq.html#school-places">x</a>'), {'faq.html#school-places'})
        self.assertEqual(archived_links('index.html', '<aside class="legacy-route" id="x"><a href="evidence.html#records">y</a></aside>'), set())

    def test_printed_visit_route_has_matching_immediate_and_native_destinations(self):
        destination = 'https://docs.google.com/forms/d/e/1FAIpQLSfwTdpsQB5HOlbJxumjINzFjWiZZCshEHUIrkgXlUDCBBPGrw/viewform'
        self.assertEqual(REDIRECT_PAGES, {'visit/index.html'})
        for name in REDIRECT_PAGES:
            page = self.pages[name]
            self.assertEqual(page.refreshes, ['0; url=' + destination])
            self.assertIn(('a', 'href', destination), page.references)
            self.assertEqual(page.scripts, [], 'This handoff needs no scripts or tracking')

    def test_source_library_and_downloads_contain_the_same_records(self):
        records = json.loads((ROOT / 'sources.json').read_text(encoding='utf-8'))['records']
        with (ROOT / 'sources.csv').open(encoding='utf-8-sig', newline='') as stream:
            rows = list(csv.DictReader(stream))
        json_ids = [record['id'] for record in records]
        csv_ids = [row['Record reference'] for row in rows]
        html_ids = self.pages['evidence.html'].source_ids
        self.assertTrue(json_ids, 'The source library must not disappear silently')
        self.assertEqual(len(json_ids), len(set(json_ids)), 'Duplicate JSON record reference')
        self.assertEqual(len(csv_ids), len(set(csv_ids)), 'Duplicate CSV record reference')
        self.assertCountEqual(csv_ids, json_ids)
        self.assertCountEqual(html_ids, ['source-' + record_id for record_id in json_ids])
        by_id = {record['id']: record for record in records}
        columns = {'Title': 'title', 'Publisher': 'publisher', 'Document date': 'date',
                   'Document type': 'type', 'Topic': 'topic', 'Review status': 'status',
                   'Summary': 'summary', 'Source URL': 'url',
                   'Document location and context': 'locator', 'Access checked': 'accessChecked', 'Year': 'year'}
        for row in rows:
            for column, key in columns.items():
                with self.subTest(record=row['Record reference'], column=column):
                    value = by_id[row['Record reference']][key]
                    self.assertEqual(row[column], '' if value is None else str(value))
        html_cards = self.pages['evidence.html'].source_cards
        for record in records:
            with self.subTest(record=record['id'], representation='HTML'):
                card = html_cards['source-' + record['id']]
                attrs = card['attrs']
                for key, attribute in (('year', 'data-year'), ('type', 'data-type'),
                                       ('topic', 'data-topic'), ('status', 'data-status')):
                    self.assertEqual(attrs[attribute], record[key])
                self.assertEqual(card['url'], record['url'])
                summary = ' '.join(''.join(card['summary']).split())
                self.assertEqual(summary, ' '.join(record['summary'].split()))
                search = ' '.join(attrs['data-search'].lower().split())
                self.assertIn(' '.join(record['summary'].lower().split()), search,
                              'A visible summary must also be searchable')


if __name__ == '__main__':
    unittest.main()
