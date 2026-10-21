"""Build the curated campaign sitemap and crawl policy; standard library only."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET
from build_navigation import SITE_URL
from check_site import ROOT, PUBLIC_FILES

# Live campaign pages only; archived pages are noindex and stay out (13 October 2026).
PAGES = ('index.html', 'dates.html', 'get-involved.html', 'updates.html',
         'about.html', 'legal-fund.html', 'letters.html', 'questions.html', 'evidence.html', 'understand.html',
         'options.html', 'lessons.html', 'lessons-sources.html')
NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'


class Head(HTMLParser):
    def __init__(self, document):
        super().__init__()
        self.in_head = False
        self.canonicals = []
        self.robots = []
        self.feed(document)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'head':
            self.in_head = True
        if not self.in_head:
            return
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name', '').lower() in {'robots', 'googlebot'}:
            self.robots.extend(attrs.get('content', '').lower().replace(',', ' ').split())

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False


def outputs(root=ROOT, pages=PAGES):
    if len(pages) != len(set(pages)):
        raise ValueError('Duplicate sitemap destination')
    ET.register_namespace('', NAMESPACE)
    sitemap = ET.Element('{'+NAMESPACE+'}urlset')
    for name in pages:
        if name not in PUBLIC_FILES or not name.endswith('.html'):
            raise ValueError('Sitemap destination is not public HTML: '+name)
        url = SITE_URL+('' if name == 'index.html' else name)
        head = Head((Path(root)/name).read_text())
        if head.canonicals != [url] or 'noindex' in head.robots or 'none' in head.robots:
            raise ValueError('Sitemap destination must be indexable and self-canonical: '+name)
        entry = ET.SubElement(sitemap, '{'+NAMESPACE+'}url')
        ET.SubElement(entry, '{'+NAMESPACE+'}loc').text = url
    ET.indent(sitemap, space='  ')
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'+ET.tostring(sitemap, encoding='unicode')+'\n'
    return {'sitemap.xml': xml, 'robots.txt': 'User-agent: *\nAllow: /\n\nSitemap: '+SITE_URL+'sitemap.xml\n'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name, content in outputs().items():
        path = ROOT/name
        if args.check:
            if not path.exists() or path.read_text() != content:
                raise SystemExit('Stale SEO asset: '+name)
        else:
            path.write_text(content)
    print('SEO assets checked' if args.check else 'SEO assets built')


if __name__ == '__main__':
    main()
