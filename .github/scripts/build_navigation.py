"""Render shared page identity and curated section navigation. No runtime dependency."""
from pathlib import Path
import argparse
import html
import re

ROOT = Path(__file__).resolve().parents[2]
VERSION = '2026100802'
PAGES = {
    # Page identity labels only. The Menu and footer come from MENU_GROUPS and
    # FOOTER_LINKS, so registering a page never adds a Menu row by itself.
    'rally.html': 'Past rally', 'letters.html': 'Community letters', 'videos.html': 'Share a video', 'feedback.html': 'Share ideas',
    'index.html': 'Home', 'about.html': 'About', 'proposal.html': 'Proposal & dates',
    'faq.html': 'FAQ', 'understand.html': 'Numbers & results', 'options.html': 'Ways to keep Kew open',
    'lessons.html': 'Lessons', 'evidence.html': 'Evidence', 'supporters.html': 'Supporters',
    'privacy.html': 'Privacy', 'corrections.html': 'Corrections',
    'lessons-sources.html': 'Research citations', 'sent.html': 'Next steps',
}
# Direct-link briefs retain the shared shell without appearing in any menu.
UNLISTED_PAGES = {
    'fundraising-trustees.html': 'Trustee brief',
    'fundraising-admin.html': 'Account setup brief',
}
PAGE_LABELS = PAGES | UNLISTED_PAGES
# Curated Menu: (group heading, [(href, label, kind)]); kind 'plan' keeps the
# Parent action plan style, 'sub' indents, and deep action links never claim the
# current page. Labels match page names so the persistent page label is familiar.
MENU_GROUPS = [
    ('Take part', [
        ('proposal.html#take-part', 'Respond to the council', 'action'),
        ('proposal.html#parent-plan', 'Parent action plan', 'plan'),
        ('letters.html', 'Community letters', ''),
        ('videos.html#upload', 'Share a video', ''),
        ('feedback.html', 'Share ideas', ''),
    ]),
    ('Understand the proposal', [
        ('proposal.html', 'Proposal & dates', ''),
        ('faq.html', 'FAQ', ''),
        ('understand.html', 'Numbers & results', ''),
        ('options.html', 'Ways to keep Kew open', ''),
        ('evidence.html#records', 'Evidence', ''),
        ('evidence.html#gaps', 'Unanswered questions', 'sub'),
    ]),
    ('This website', [
        ('index.html', 'Home', ''),
        ('about.html', 'About & contact', ''),
    ]),
]
# Every page's footer, including the destinations kept out of the Menu.
FOOTER_LINKS = [
    ('about.html', 'About & contact', ''), ('proposal.html', 'Proposal & dates', ''),
    ('faq.html', 'FAQ', ''), ('evidence.html#records', 'Evidence', ''),
    ('letters.html', 'Community letters', ''), ('feedback.html', 'Share ideas', ''),
    ('videos.html#upload', 'Share a video', ''), ('lessons.html', 'Lessons', ''),
    ('supporters.html', 'Supporters', ''), ('corrections.html', 'Corrections', ''),
    ('lessons-sources.html', 'Research citations', ''), ('privacy.html', 'Privacy', ''),
    ('privacy.html#analytics', 'Analytics choices', ' data-analytics-choices'),
]
# Explicit destinations avoid navigation generated from hidden templates or every source card.
SECTIONS = {
    'rally.html': [('when-and-where','Past event'),('schedule','Advertised schedule'),('attending','Original access notes'),('photos','Photo choices'),('council-and-response','Council and your response'),('updates','Questions or corrections')],
    'index.html': [('find-your-way','Find what you need'),('research-shortcut','Historical research','find-your-way'),('quick-answers','Before you respond'),('visit-school','Considering Kew Riverside Primary School?')],
    'evidence.html': [('records','Current Kew findings'),('london-findings','Lessons from other schools','records'),('finding-st-john','St John the Divine','records'),('finding-linked-schools','Fenstanton & Holy Trinity','records'),('finding-pooles','Pooles Park','records'),('source-search','Find a source'),('source-library','Original sources','source-search'),('evidence','Numbers behind the proposal'),('timeline','Dates and next steps'),('earlier-record','Earlier public record'),('gaps','Unanswered questions'),('gap-budget','Keeping Kew open','gaps'),('gap-pupil-impacts',"Children’s needs",'gaps'),('gap-selection','Why Kew?','gaps'),('gap-closure-costs','Closure costs and site','gaps'),('gap-alternatives','Costed alternatives','gaps'),('gap-recruitment','Recruitment support','gaps'),('gap-forecasts','Pupil and housing forecasts','gaps'),('gap-answers','Written answers','gaps'),('evidence-found','Evidence obtained','gaps'),('gap-records','Process and records','gaps'),('method','Method and limits')],
    'options.html': [('option-7','Your official response'),('options-prep-title','Prepare together'),('options-findings-title','What an alternative needs'),('options-navigation','Ways to help'),('option-recovery-plan','A practical recovery plan','options-navigation'),('option-crowdfunding','Funding','options-navigation'),('option-demand','Pupil demand','options-navigation'),('option-enrolment','School enquiries','options-navigation'),('option-5','Closure costs','options-navigation'),('option-6',"Children’s needs",'options-navigation'),('option-8','Legal experience','options-navigation'),('options-sources-title','Evidence and next steps')],
    'proposal.html': [('parent-plan','Parent action plan'),('plan-share','Evidence and letters','parent-plan'),('plan-respond','Your response','parent-plan'),('plan-keep-going','More ways to help','parent-plan'),('past-parent-events','Past events'),('timetable','Timeline'),('questions','Questions worth asking'),('question-continuity',"Your child’s next school",'questions'),('question-learning',"Your child’s learning",'questions'),('question-budget','The budget','questions'),('question-closure-costs','Closure costs','questions'),('question-demand','Pupil forecasts','questions'),('question-alternatives','Alternatives','questions'),('who-decides','Who decides'),('other-schools','Lessons from other schools'),('decision-record','Decision record'),('take-part','Official response routes')],
    'understand.html': [('pupil-trends','Pupil numbers'),('forecast-checks','Forecast checks'),('school-places','Unfilled places'),('year-groups','Year groups'),('budget','School finances'),('closure-costs','Closure costs','budget'),('other-proposals','Other Richmond proposals'),('learning-and-results','Learning and results'),('inspection-summary','Inspection findings','learning-and-results'),('mixed-age-curriculum','Mixed-age learning','learning-and-results'),('methodology','Method and limits')],
    'faq.html': [('taking-part','Ways to help'),('decisions','Dates and decisions'),('money','Money'),('school-places','School places'),('learning','Learning and results')],
    'lessons.html': [('key-lessons','Key lessons'),('visual-guide','Visual guide'),('catalogue','All 16 schools'),('method','Method and limits')],
    'lessons-sources.html': [('source-register','Source register'),('claim-ledger','Evidence and interpretation')],
    'about.html': [('our-story','Our family story'),('site-responsibility','Who is responsible'),('updates','What has changed'),('contact','Contact Yann')],
    'letters.html': [('letters','Read community letters'),('letter-form','Write a letter'),('letter-guidelines','Letter guidelines')],
    'feedback.html': [('feedback-form','Share an idea or question'),('review-rules','How review works'),('suggestions','Read shared ideas')],
    # The short video page needs no section list beside the Menu.
    'supporters.html': [('supporter-form','Supporter statement'),('supporter-list-section','Confirmed supporters')],
    'privacy.html': [('public-roles','Public roles'),('funding-privacy','Funding ideas'),('supporters-privacy','Supporters'),('contact-privacy','Private contact'),('letters-privacy','Community letters'),('video-privacy','Videos'),('requests','Your choices'),('analytics','Analytics'),('device-storage','On-device storage')],
}

def render_navigation(name, document):
    if name not in PAGE_LABELS or 'class="site-header"' not in document:
        return document
    esc = html.escape
    document = re.sub(r'<!-- orientation:start -->.*?<!-- orientation:end -->', '', document, flags=re.S)
    document = re.sub(r'<link rel="stylesheet" href="orientation\.css(?:\?v=\d+)?">', '', document)
    document = re.sub(r'navigation\.js\?v=\d+', 'navigation.js?v='+VERSION, document)
    # Deferred scripts must follow every stylesheet they measure. Navigation sets
    # the final fragment offsets before page-specific disclosure/reveal scripts.
    head, separator, body = document.partition('</head>')
    deferred_pattern = r'<script\b[^>]*\bdefer\b[^>]*>.*?</script>'
    deferred = re.findall(deferred_pattern, head, re.S)
    head = re.sub(deferred_pattern, '', head, flags=re.S)
    deferred.sort(key=lambda script: 0 if 'src="navigation.js?' in script else 1)
    # Keep the existing synchronous, pre-paint theme initializer after the final
    # stylesheet too. This parser barrier also covers WebKit's early defer path.
    theme_pattern = r'<script src="theme\.js\?v=\d+"></script>'
    theme = re.search(theme_pattern, head)
    theme_script = theme.group() if theme else ''
    head = re.sub(theme_pattern, '', head)
    head = re.sub(r'(?m)^ +$', '', head)
    document = head+'<link rel="stylesheet" href="orientation.css?v='+VERSION+'">'+theme_script+''.join(deferred)+separator+body
    match = re.search(r'<header class="site-header">.*?</header>', document, re.S)
    header = match.group()
    header = re.sub(r'<details class="mobile-menu">.*?</details>', '', header, flags=re.S)
    header = re.sub(r' aria-current="page"', '', header)
    # Keep the short wide-screen exploration row. The full menu is available at every width.
    desktop = [('proposal.html#parent-plan','Parent action plan'),('about.html','About'),('proposal.html','Proposal & dates'),('understand.html','Numbers & results'),('faq.html','FAQ'),('evidence.html#records','Evidence')]
    def link(href, label, parent=False):
        current = ' aria-current="page"' if href.split('#')[0] == name and not parent else ''
        cls = ' class="nav-parent-plan"' if parent else ''
        return f'<a href="{esc(href)}"{cls}{current}>{esc(label)}</a>'
    desktop_html = '<nav class="desktop-explore" aria-label="Explore the website">'+''.join(link(h,l,'#parent-plan' in h) for h,l in desktop)+'</nav>'
    header = re.sub(r'<nav class="desktop-explore".*?</nav>', desktop_html, header, flags=re.S)
    # Participation tiles remain exposed on arrival and identify their own pages.
    header = re.sub(r'<a href="(letters|feedback)\.html"', lambda m:m.group()+(' aria-current="page"' if m.group(1)+'.html' == name else ''), header)
    # The Menu is chosen, not generated from every page label: three groups, with
    # the official response first. Adding an entry means removing or merging one.
    # Pages not listed here stay one tap away in every footer (FOOTER_LINKS).
    def menu_link(href, label, kind=''):
        base = href.split('#')[0]
        current = ' aria-current="page"' if base == name and kind == '' else ''
        cls = {'plan': ' class="nav-parent-plan"', 'action': ' class="nav-respond"', 'sub': ' class="nav-subitem"'}.get(kind, '')
        return f'<a href="{esc(href)}"{cls}{current}>{esc(label)}</a>'
    groups = []
    for index, (heading, entries) in enumerate(MENU_GROUPS, 1):
        entries = list(entries)
        if heading == 'This website' and name == 'sent.html':
            entries.append(('sent.html', 'Next steps', ''))
        links = ''.join(menu_link(*entry) for entry in entries)
        groups.append(f'<div class="menu-group" role="group" aria-labelledby="menu-group-{index}"><p class="menu-group-label" id="menu-group-{index}">{esc(heading)}</p>{links}</div>')
    menu = '<details class="mobile-menu" name="site-navigation"><summary>Menu <span aria-hidden="true">⌄</span></summary><nav aria-label="All website pages">'+''.join(groups)+'</nav></details>'
    ids = set(re.findall(r'\bid="([^"]+)"', document))
    sections = [entry for entry in SECTIONS.get(name,[]) if entry[0] in ids]
    section_html = ''
    if len(sections) > 1:
        items = []
        for entry in sections:
            ident,label = entry[:2]
            parent = f' data-parent="{esc(entry[2])}"' if len(entry)>2 else ''
            items.append(f'<a href="#{esc(ident)}" data-section-id="{esc(ident)}"{parent}>{esc(label)}</a>')
        section_html = '<details class="page-sections" name="site-navigation"><summary><span class="section-prompt">On this page</span><span class="section-trail">Choose a section</span><span class="section-chevron" aria-hidden="true">⌄</span></summary><div class="section-panel"><nav class="section-links" aria-label="On this page">'+''.join(items)+'<a href="#main" class="section-top">Back to top</a></nav><div class="section-share" hidden><button type="button" class="section-copy">Copy link to this section</button><input class="section-copy-fallback" aria-label="Section link" readonly hidden><span class="section-copy-status" role="status"></span></div></div></details>'
    orientation = '<!-- orientation:start --><div class="site-orientation"><div class="wrap orientation-inner"><span class="page-name">'+esc(PAGE_LABELS[name])+'</span>'+section_html+menu+'</div></div><!-- orientation:end -->'
    header = header.replace('</header>',orientation+'</header>')
    document = document[:match.start()]+header+document[match.end():]
    footer_links = ''.join(f'<a href="{esc(href)}"{extra}>{esc(label)}</a>' for href, label, extra in FOOTER_LINKS)
    document = re.sub(r'(<footer><div class="wrap footer-inner"><div>.*?</div>)<div>.*?</div>(</div></footer>)', lambda m: m.group(1)+'<div>'+footer_links+'</div>'+m.group(2), document, count=1, flags=re.S)
    return document

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name in PAGE_LABELS:
        path = ROOT/name
        before = path.read_text()
        after = render_navigation(name,before)
        if args.check and after != before:
            raise SystemExit(name+' navigation is stale; run build_navigation.py')
        if not args.check:
            path.write_text(after)
    print('Shared navigation '+('verified' if args.check else 'built'))
