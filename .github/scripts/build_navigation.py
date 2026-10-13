"""Render shared page identity and curated section navigation. No runtime dependency."""
from pathlib import Path
import argparse
import html
import re

ROOT = Path(__file__).resolve().parents[2]
VERSION = '2026101303'
PREVIEW_VERSION = '2026100901'  # Shared images are unchanged by this curation.
SITE_NAME = 'Save Kew Riverside Primary School Campaign'
SITE_URL = 'https://savekewriversideprimaryschool.org/'
PAGES = {
    # Page identity labels only. The Menu and footer come from MENU_GROUPS and
    # FOOTER_LINKS, so registering a page never adds a Menu row by itself.
    'rally.html': 'Past rally', 'letters.html': 'Community letters', 'videos.html': 'Share a video', 'feedback.html': 'Share ideas',
    'index.html': 'Home', 'about.html': 'About', 'proposal.html': 'Proposal & dates',
    'faq.html': 'FAQ', 'understand.html': 'Our case for Kew', 'options.html': 'Ways to keep Kew open',
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
    ('Keep Kew open', [
        ('proposal.html', 'Proposal & dates', ''),
        ('proposal.html#council-documents', 'Council dates & documents', 'sub'),
        ('faq.html', 'FAQ', ''),
        ('options.html', 'Ways to keep Kew open', ''),
        ('evidence.html#records', 'Evidence', ''),
        ('understand.html#supporting-research', 'Supporting research', 'sub'),
    ]),
    ('This website', [
        ('index.html', 'Home', ''),
        ('about.html', 'About & contact', ''),
    ]),
]
# Every page's footer, including the destinations kept out of the Menu.
FOOTER_LINKS = [
    ('about.html', 'About & contact', ''), ('about.html#press', 'For journalists', ''), ('proposal.html', 'Proposal & dates', ''),
    ('faq.html', 'FAQ', ''), ('evidence.html#records', 'Evidence', ''),
    ('letters.html', 'Community letters', ''), ('feedback.html', 'Share ideas', ''),
    ('videos.html#upload', 'Share a video', ''), ('understand.html', 'Our case for Kew', ''), ('lessons.html', 'Lessons', ''),
    ('supporters.html', 'Supporters', ''), ('corrections.html', 'Corrections', ''),
    ('lessons-sources.html', 'Research citations', ''), ('privacy.html', 'Privacy', ''),
    ('privacy.html#analytics', 'Analytics choices', ' data-analytics-choices'),
]
# Explicit destinations avoid navigation generated from hidden templates or every source card.
SECTIONS = {
    'rally.html': [('when-and-where','Past event'),('schedule','Advertised schedule'),('attending','Original access notes'),('photos','Photo choices'),('council-and-response','Council and your response'),('updates','Questions or corrections')],
    'index.html': [('find-your-way','Find what you need'),('research-shortcut','Historical research','find-your-way'),('quick-answers','Before you respond'),('visit-school','Considering Kew Riverside Primary School?')],
    'evidence.html': [('records','Current Kew findings'),('london-findings','Lessons from other schools','records'),('finding-st-john','St John the Divine','records'),('finding-linked-schools','Fenstanton & Holy Trinity','records'),('finding-pooles','Pooles Park','records'),('source-search','Find a source'),('source-library','Original sources','source-search'),('evidence','Numbers behind the proposal'),('timeline','Dates and next steps'),('earlier-record','Earlier public record'),('gaps','Archived questions'),('method','Method and limits')],
    'options.html': [('option-7','Your official response'),('options-prep-title','Prepare together'),('options-findings-title','What an alternative needs'),('options-navigation','Ways to help'),('option-recovery-plan','A costed alternative','options-navigation'),('option-crowdfunding','Funding','options-navigation'),('option-demand','Pupil demand','options-navigation'),('option-enrolment','School enquiries','options-navigation'),('option-5','Closure costs','options-navigation'),('option-6',"Children’s needs",'options-navigation'),('option-8','Legal experience','options-navigation'),('options-sources-title','Evidence and next steps')],
    'proposal.html': [('council-documents','Council timetable and documents'),('parent-plan','Parent action plan'),('plan-share','Evidence and letters','parent-plan'),('plan-respond','Your response','parent-plan'),('plan-keep-going','More ways to help','parent-plan'),('past-parent-events','Past events'),('timetable','Timeline'),('questions','Questions worth asking'),('question-continuity',"Your child’s next school",'questions'),('question-learning',"Your child’s learning",'questions'),('question-budget','The budget','questions'),('question-closure-costs','Closure costs','questions'),('question-demand','Pupil forecasts','questions'),('question-alternatives','Alternatives','questions'),('who-decides','Who decides'),('other-schools','Lessons from other schools'),('decision-record','Decision record'),('take-part','Official response routes')],
    'understand.html': [('supporting-research','Supporting research'),('pupil-trends','Pupil numbers'),('forecast-checks','Forecast checks'),('school-places','Unfilled places'),('year-groups','Year groups'),('budget','School finances'),('closure-costs','Closure costs','budget'),('other-proposals','Other Richmond proposals'),('learning-and-results','Learning and results'),('inspection-summary','Inspection findings','learning-and-results'),('mixed-age-curriculum','Mixed-age learning','learning-and-results'),('methodology','Method and limits')],
    'faq.html': [('taking-part','Ways to help'),('decisions','Dates and decisions'),('money','Money'),('school-places','School places'),('learning','Learning and results')],
    'lessons.html': [('key-lessons','Key lessons'),('visual-guide','Visual guide'),('catalogue','All 16 schools'),('method','Method and limits')],
    'lessons-sources.html': [('source-register','Source register'),('claim-ledger','Evidence and interpretation')],
    'about.html': [('our-story','Our family story'),('site-responsibility','Who is responsible'),('press','For journalists'),('updates','What has changed'),('contact','Contact Yann')],
    'letters.html': [('letters','Read community letters'),('letter-form','Write a letter'),('letter-guidelines','Letter guidelines')],
    'feedback.html': [('feedback-form','Share an idea or question'),('review-rules','How review works'),('suggestions','Read shared ideas')],
    # The short video page needs no section list beside the Menu.
    'supporters.html': [('supporter-form','Supporter statement'),('supporter-list-section','Confirmed supporters')],
    'privacy.html': [('public-roles','Public roles'),('funding-privacy','Funding ideas'),('supporters-privacy','Supporters'),('contact-privacy','Private contact'),('letters-privacy','Community letters'),('video-privacy','Videos'),('requests','Your choices'),('analytics','Analytics'),('device-storage','On-device storage')],
}

def render_identity(name, document):
    """Keep publisher identity in generated and maintained pages alike."""
    esc = html.escape
    titles = {
        'index.html': SITE_NAME,
        'letters.html': 'Community letters',
        'about.html': 'Our story & contact',
        'proposal.html': 'Kew Riverside Primary School closure proposal: consultation and dates',
        'understand.html': 'The case for keeping Kew Riverside Primary School open',
        'faq.html': 'Kew Riverside closure proposal: answers for families',
        'evidence.html': 'Keeping Kew Riverside open: evidence and questions for the council',
        'options.html': 'Alternatives to closing Kew Riverside Primary School',
        'lessons.html': 'School closure reprieves: selected cases and lessons for Kew',
        'lessons-sources.html': 'Research citations',
        'feedback.html': 'Ideas, evidence & questions',
        'videos.html': 'Parent testimonials',
        'supporters.html': 'Named supporters',
        'privacy.html': 'Privacy & moderation',
        'corrections.html': 'Private corrections',
        'rally.html': 'Past advertised rally · 6 October',
        'sent.html': 'Next steps',
        'fundraising-trustees.html': 'Trustee brief',
        'fundraising-admin.html': 'Account setup brief',
    }
    descriptions = {
        'index.html': 'Help keep Kew Riverside Primary School open. Find the parent action plan, community letters, alternatives to closure and the official consultation response route.',
        'proposal.html': 'Understand the proposed closure of Kew Riverside Primary School, the consultation process, who decides and the parent action plan. Responses are due by 16 October 2026.',
        'faq.html': 'Answers for families about the Kew Riverside Primary School closure proposal, consultation, school places and how to respond, with links to official sources.',
        'understand.html': 'Our case for keeping Kew Riverside Primary School open: assess alternatives, compare the full costs and protect children’s continuity. Supporting research and sources are available to check.',
        'evidence.html': 'Evidence for challenging the proposed closure of Kew Riverside Primary School: alternatives, full costs, children’s needs and questions for the council, with original sources to check.',
        'options.html': 'Explore alternatives to closing Kew Riverside Primary School and the evidence needed to assess them, with practical next steps in the parent action plan.',
        'lessons.html': 'Compare 12 selected reprieve schools across nine decision episodes with four closed schools. Examine the evidence, limits and lessons for Kew Riverside; reprieve does not establish lasting recovery.',
    }
    # Metadata belongs to the document head. Body SVG titles describe chart
    # points and must survive both maintained-page and research regeneration.
    document, separator, body = document.partition('</head>')
    if not separator:
        raise ValueError('Missing document head: '+name)
    document += separator
    title = titles[name] + ('' if name == 'index.html' else ' | ' + SITE_NAME)
    document = re.sub(r'<title>.*?</title>', '<title>'+esc(title)+'</title>', document, flags=re.S)
    def meta(document, attribute, key, value):
        tag = '<meta '+attribute+'="'+key+'" content="'+esc(value, quote=True)+'">'
        pattern = r'<meta '+attribute+'="'+re.escape(key)+r'"[^>]*>'
        document = re.sub(pattern, '', document)
        return document.replace('</head>', tag+'</head>', 1)
    for attribute, key in [('name', 'description'), ('property', 'og:description')]:
        # Research builders start with Proposal's head; use their own page description.
        source_attribute, source_key = ('name', 'description') if name in ('lessons.html', 'lessons-sources.html', 'understand.html') else (attribute, key)
        match = re.search(r'<meta '+source_attribute+'="'+source_key+r'" content="([^"]*)"', document)
        description = descriptions.get(name, html.unescape(match.group(1)) if match else titles[name]+'.')
        prefix = 'Independent parent-led campaign. '
        if not description.startswith(prefix):
            description = prefix+description
        document = meta(document, attribute, key, description)
    for key, value in [('og:site_name', SITE_NAME), ('og:title', title), ('og:type', 'website'),
                       ('og:url', SITE_URL+('' if name == 'index.html' else name))]:
        document = meta(document, 'property', key, value)
    if '<meta name="twitter:title"' in document:
        document = meta(document, 'name', 'twitter:title', title)
    if '<meta name="twitter:description"' in document:
        description = re.search(r'<meta property="og:description" content="([^"]*)"', document).group(1)
        document = meta(document, 'name', 'twitter:description', html.unescape(description))
    document = re.sub(r'<link rel="canonical"[^>]*>', '', document)
    document = document.replace('</head>', '<link rel="canonical" href="'+SITE_URL+('' if name == 'index.html' else name)+'"></head>', 1)
    document = re.sub(r'(og-[^"?]+\.png)\?v=\d+', r'\1?v='+PREVIEW_VERSION, document)
    if name == 'index.html':
        document = re.sub(r'<html\b[^>]*>', '<html lang="en-GB" itemscope itemtype="https://schema.org/WebSite">', document, count=1)
        document = meta(document, 'itemprop', 'name', SITE_NAME)
        document = re.sub(r'<link itemprop="url"[^>]*>', '', document)
        document = document.replace('</head>', '<link itemprop="url" href="'+SITE_URL+'"></head>', 1)
    document += body
    def brand(match):
        opening = re.sub(r'aria-label="[^"]*"', 'aria-label="'+SITE_NAME+' home"', match.group(1))
        symbol = match.group(2).split('</svg>', 1)[0]+'</svg>'
        wording = '<span>Save Kew Riverside<br>Primary School<small class="campaign-subtitle"><strong>CAMPAIGN</strong><span>Independent and parent-led</span></small></span>'
        return opening+symbol+wording+'</a>'
    document = re.sub(r'(<a class="brand"[^>]*>)(.*?)</a>', brand, document, count=1, flags=re.S)
    # The masthead carries independence; retain scoped update dates without
    # repeating identity in a separate strip above it.
    document = re.sub(r'(<div class="independent-bar"><div class="wrap">)<span>[^<]*</span>(?=<span>)',
                      r'\1', document, count=1, flags=re.S)
    footer = '<footer><div class="wrap footer-inner"><div><strong>'+esc(SITE_NAME)+'</strong><p>An independent parent-led website to help keep the school open.<br>Created and maintained by <a href="about.html#site-responsibility">Yann Stoneman</a>.</p></div>'
    document = re.sub(r'<footer><div class="wrap footer-inner"><div>.*?</div>', footer, document, count=1, flags=re.S)
    return document

def render_footer_discovery(document):
    # Independent parent videos and school visits have distinct labels; this row
    # never carries petition or closure-campaign requests.
    youtube = '<svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true" focusable="false"><rect width="28" height="20" rx="5" fill="currentColor"/><path d="M11 5.5v9l8-4.5z" fill="var(--theme-background, var(--paper, #fbfaf6))"/></svg>'
    row = '<!-- footer-discovery:start --><div class="wrap footer-discovery"><a class="footer-youtube" href="https://www.youtube.com/@KewParentVoices">'+youtube+'<span>Parent Voices on YouTube</span></a><a class="footer-open-days" href="https://docs.google.com/forms/d/e/1FAIpQLSfwTdpsQB5HOlbJxumjINzFjWiZZCshEHUIrkgXlUDCBBPGrw/viewform">Visit our Open Days <span aria-hidden="true">↗&#xFE0E;</span></a></div><!-- footer-discovery:end -->'
    document = re.sub(r'<!-- footer-discovery:start -->.*?<!-- footer-discovery:end -->', '', document, flags=re.S)
    document = document.replace('</footer>', row+'</footer>')
    link = '<link rel="stylesheet" href="footer-links.css?v=2026101303">'
    document = re.sub(r'<link rel="stylesheet" href="footer-links\.css(?:\?v=\d+)?">', '', document)
    document = document.replace('<link rel="stylesheet"',link+'<link rel="stylesheet"',1)
    return document

def render_home_navigation(document):
    """Owner-approved compact homepage; other pages retain the shared shell.
    Its Menu lists exactly the same entries as every other page (13 October 2026)."""
    document = render_identity('index.html', document)
    document = re.sub(r'navigation\.js\?v=\d+', 'navigation.js?v='+VERSION, document)
    groups = []
    for index, (heading, entries) in enumerate(MENU_GROUPS, 1):
        links = ''.join('<a href="'+html.escape(href, quote=True)+'"'+(' aria-current="page"' if href == 'index.html' else '')+(' class="nav-respond"' if href == 'proposal.html#take-part' else '')+'>'+html.escape(label)+'</a>' for href,label,kind in entries)
        groups.append('<div class="menu-group" role="group" aria-labelledby="menu-group-'+str(index)+'"><p class="menu-group-label" id="menu-group-'+str(index)+'">'+html.escape(heading)+'</p>'+links+'</div>')
    menu = '<details class="mobile-menu" id="menu" name="site-navigation"><summary>Menu <span aria-hidden="true">⌄</span></summary><nav class="desktop-explore" aria-label="All website pages">'+''.join(groups)+'</nav></details>'
    document = re.sub(r'<details class="mobile-menu" id="menu"[^>]*>.*?</details>', lambda _:menu, document, count=1, flags=re.S)
    footer = ''.join('<a href="'+html.escape(href, quote=True)+'"'+extra+'>'+html.escape(label)+'</a>' for href,label,extra in FOOTER_LINKS)
    document = re.sub(r'(<nav class="home-footer-links"[^>]*>).*?(</nav>)',lambda m:m.group(1)+footer+m.group(2),document,count=1,flags=re.S)
    return render_footer_discovery(document)

def render_navigation(name, document):
    if name not in PAGE_LABELS or 'class="site-header"' not in document:
        return document
    if name == 'index.html' and 'data-home-landing' in document:
        return render_home_navigation(document)
    document = render_identity(name, document)
    for asset in ('letters.js', 'contribute.css', 'feedback.css', 'community.css', 'discovery.css'):
        document = re.sub(re.escape(asset)+r'\?v=\d+', asset+'?v='+VERSION, document)
    esc = html.escape
    def compact_body(match):
        tag = match.group()
        classes = re.search(r'class="([^"]*)"', tag)
        if classes:
            values = classes.group(1).split()
            if 'simple-page' not in values:
                tag = tag.replace(classes.group(), 'class="'+' '.join(values+['simple-page'])+'"')
        else:
            tag = tag[:-1]+' class="simple-page">'
        return tag
    document = re.sub(r'<body\b[^>]*>', compact_body, document, count=1)
    def current_response(match):
        tag = match.group()
        if 'data-current-response' not in tag:
            tag = tag[:-1]+' data-current-response>'
        return tag
    document = re.sub(r'<a\b(?=[^>]*href="https://docs\.google\.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform")[^>]*>', current_response, document)
    document = re.sub(r'<link rel="stylesheet" href="simplify\.css(?:\?v=\d+)?">', '', document)
    document = re.sub(r'<script src="simplify\.js(?:\?v=\d+)?" defer></script>', '', document)
    document = document.replace('</head>', '<link rel="stylesheet" href="simplify.css?v='+VERSION+'"><script src="simplify.js?v='+VERSION+'" defer></script></head>', 1)
    toolbar = '<div class="simple-toolbar"><button type="button" data-simple-toggle hidden>Show the full page</button></div>'
    document = document.replace(toolbar, '')
    document = document.replace('</main>', toolbar+'</main>', 1)
    document = re.sub(r'<!-- orientation:start -->.*?<!-- orientation:end -->', '', document, flags=re.S)
    document = re.sub(r'<link rel="stylesheet" href="orientation\.css(?:\?v=\d+)?">', '', document)
    document = re.sub(r'navigation\.js\?v=\d+', 'navigation.js?v='+VERSION, document)
    # Deferred scripts must follow every stylesheet they measure. Navigation sets
    # the final fragment offsets before page-specific disclosure/reveal scripts.
    head, separator, body = document.partition('</head>')
    deferred_pattern = r'<script\b[^>]*\bdefer\b[^>]*>.*?</script>'
    deferred = re.findall(deferred_pattern, head, re.S)
    head = re.sub(deferred_pattern, '', head, flags=re.S)
    deferred.sort(key=lambda script: 0 if 'src="navigation.js?' in script else 2 if 'src="simplify.js?' in script else 1)
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
    desktop = [('proposal.html#parent-plan','Parent action plan')]
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
    status = re.search(r'<div class="independent-bar"><div class="wrap">(.*?)</div></div>', document, re.S)
    mobile_status = '<div class="mobile-page-note"><p class="menu-group-label">Page information</p>'+status.group(1)+'</div>' if status else ''
    menu = '<details class="mobile-menu" name="site-navigation"><summary>Menu <span aria-hidden="true">⌄</span></summary><nav aria-label="All website pages">'+''.join(groups)+mobile_status+'</nav></details>'
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
    return render_footer_discovery(document)

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
