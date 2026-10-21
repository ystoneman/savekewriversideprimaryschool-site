"""Guard crawl discovery, packaging and generated head/body boundaries."""
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from build_navigation import render_identity, render_navigation, SITE_NAME, SITE_URL
from build_seo import outputs, PAGES, Head, NAMESPACE
from check_site import ROOT, stage_site, PUBLIC_FILES, MAINTENANCE_FILES


class SEOTests(unittest.TestCase):
    def test_exact_canonical_destinations_and_no_invented_dates(self):
        tree = ET.fromstring(outputs()['sitemap.xml'])
        urls = [entry.find('{'+NAMESPACE+'}loc').text for entry in tree]
        expected = ['https://savekewriversideprimaryschool.org/'+name for name in
                    ('', 'dates.html', 'get-involved.html', 'updates.html', 'about.html', 'legal-fund.html', 'letters.html', 'questions.html', 'evidence.html', 'understand.html', 'options.html', 'lessons.html', 'lessons-sources.html')]
        self.assertEqual(urls, expected)
        self.assertEqual(len(urls), len(set(urls)))
        self.assertTrue(all(len(entry) == 1 for entry in tree))
        self.assertEqual(outputs()['robots.txt'], 'User-agent: *\nAllow: /\n\nSitemap: https://savekewriversideprimaryschool.org/sitemap.xml\n')

    def test_invalid_destinations_rejected(self):
        for pages in [('index.html', 'index.html'), ('sent.html',),
                      ('fundraising-trustees.html',), ('fundraising-admin.html',),
                      ('proposal.html',), ('faq.html',),
                      ('private.html',), ('letters.json',)]:
            with self.subTest(pages=pages), self.assertRaises(ValueError):
                outputs(pages=pages)
        with tempfile.TemporaryDirectory() as tmp:
            page = Path(tmp)/'index.html'
            for canonical in ['https://savekewriverside.org/', SITE_URL+'?filter=1', SITE_URL+'#main']:
                page.write_text('<head><link rel="canonical" href="'+canonical+'"></head>')
                with self.assertRaises(ValueError):
                    outputs(root=tmp, pages=('index.html',))
            page.write_text('<head><link rel="canonical" href="'+SITE_URL+'"><meta name="googlebot" content="none"></head>')
            with self.assertRaises(ValueError):
                outputs(root=tmp, pages=('index.html',))

    def test_generated_assets_and_public_artifact(self):
        subprocess.run(['python3', str(ROOT/'.github/scripts/build_seo.py'), '--check'], check=True, capture_output=True)
        for name, content in outputs().items():
            self.assertEqual((ROOT/name).read_text(), content)
        with tempfile.TemporaryDirectory() as tmp:
            staged = Path(tmp)/'site'
            stage_site(staged)
            files = {p.relative_to(staged).as_posix() for p in staged.rglob('*') if p.is_file()}
            self.assertEqual(files, PUBLIC_FILES)
            self.assertFalse(files & MAINTENANCE_FILES)
            for name in ('sitemap.xml', 'robots.txt'):
                self.assertEqual((staged/name).read_bytes(), (ROOT/name).read_bytes())

    def test_metadata_is_head_only_and_idempotent(self):
        source = (ROOT/'evidence.html').read_text()
        # Bare and attributed SVG titles, plus metadata-like body content, expose
        # the old global regex rather than checking only the updated page title.
        body = '<svg><title>2025/26: 87 pupils, reported</title><title id="chart">Pupil forecast</title></svg><link rel="canonical" href="body-example"><meta name="description" content="Body example">'
        source = source.split('</head>')[0]+'</head>'+body
        generated = render_identity('evidence.html', source)
        self.assertEqual(generated.split('</head>', 1)[1], body)
        self.assertEqual(render_identity('evidence.html', generated), generated)

    def test_page_metadata_and_chart_labels(self):
        for name in PAGES:
            source = (ROOT/name).read_text()
            head = source.split('</head>', 1)[0]
            parser = Head(source)
            self.assertEqual(parser.canonicals, [SITE_URL+('' if name == 'index.html' else name)])
            title = re.findall(r'<title>(.*?)</title>', head, re.S)
            self.assertEqual(len(title), 1)
            self.assertIn(SITE_NAME, title[0])
            self.assertIn('Independent parent-led campaign.', head)
            self.assertEqual(render_navigation(name, source), source)
            for meta in ('og:title', 'twitter:title'):
                match = re.search(r'<meta (?:property|name)="'+meta+'" content="([^"]*)"', head)
                if match:
                    self.assertEqual(match.group(1), title[0])
        labels = re.findall(r'<title>(.*?)</title>', (ROOT/'evidence.html').read_text().split('</head>', 1)[1], re.S)
        self.assertEqual(len(labels), 22)
        self.assertEqual(labels[0], '2021/22: 145 pupils, reported')
        self.assertIn('2025/26: 87 pupils, reported', labels)
        self.assertIn('2031/32: 77 pupils, council forecast', labels)
        self.assertIn('2015: 2,486 applications', labels)
        self.assertFalse(any(SITE_NAME in label for label in labels))
        for name in ('understand.html', 'lessons.html'):
            labels = re.findall(r'<title[^>]*>(.*?)</title>', (ROOT/name).read_text().split('</head>', 1)[1], re.S)
            self.assertFalse(any(SITE_NAME in label for label in labels), name)
        verification = re.findall(r'<meta name="google-site-verification" content="([^"]+)"', (ROOT/'index.html').read_text())
        self.assertEqual(len(verification), 1)
        self.assertTrue(verification[0])
