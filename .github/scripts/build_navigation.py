"""Render shared page identity and curated section navigation. No runtime dependency."""
from pathlib import Path
import argparse
import html
import re

ROOT = Path(__file__).resolve().parents[2]
VERSION = '2026101401'
PREVIEW_VERSION = '2026100901'  # Shared images are unchanged by this curation.
SITE_NAME = 'Save Kew Riverside Primary School Campaign'
SITE_URL = 'https://savekewriversideprimaryschool.org/'
PAGES = {
    # Live pages (13 October 2026: the slim five-page campaign site). Page identity
    # labels only; the Menu and footer come from MENU_GROUPS and FOOTER_LINKS.
    'index.html': 'Home', 'dates.html': 'Dates, leaflet & FAQs', 'get-involved.html': 'Get involved',
    'updates.html': 'Campaign updates', 'about.html': 'About & contact',
    'letters.html': 'Community letters', 'videos.html': 'Share a video', 'feedback.html': 'Share ideas',
    'privacy.html': 'Privacy', 'corrections.html': 'Corrections', 'sent.html': 'Next steps',
}
# Maintained secondary detail, outside the campaign Menu.
SUPPORTING_PAGES = {
    'questions.html': 'Six questions worth asking', 'evidence.html': 'Evidence & sources',
    'understand.html': 'School finances & pupil numbers', 'options.html': 'Ways to keep Kew open',
    'lessons.html': 'Historical school cases', 'lessons-sources.html': 'Research citations',
}
# Retired pages stay served for old links with a banner and noindex.
ARCHIVED_PAGES = {
    'proposal.html': 'Proposal & dates', 'faq.html': 'FAQ', 'rally.html': 'Past rally',
    'supporters.html': 'Supporters', 'fundraising-trustees.html': 'Trustee brief',
    'fundraising-admin.html': 'Account setup brief',
}
PAGE_LABELS = PAGES | SUPPORTING_PAGES | ARCHIVED_PAGES
# One Menu on every page: the five campaign pages. Adding an entry means removing one.
MENU_GROUPS = [
    ('Campaign', [
        ('index.html', 'Home', ''),
        ('dates.html', 'Dates, leaflet & FAQs', ''),
        ('get-involved.html', 'Get involved', ''),
        ('updates.html', 'Campaign updates', ''),
        ('about.html', 'About & contact', ''),
    ]),
    # Recruitment routes stay in their own group, apart from campaign actions.
    ('Discover the school', [
        ('videos.html#watch-parent-voices', 'Watch Parent Voices', 'sub'),
        ('visit/index.html', 'Book an Open Day', 'sub'),
    ]),
]
# Every page's footer: live pages only.
FOOTER_LINKS = [
    ('about.html', 'About & contact', ''), ('about.html#press', 'For journalists', ''),
    ('dates.html', 'Dates, leaflet & FAQs', ''), ('get-involved.html', 'Get involved', ''),
    ('updates.html', 'Campaign updates', ''), ('letters.html', 'Community letters', ''),
    ('videos.html#upload', 'Share a video', ''), ('feedback.html', 'Share ideas', ''),
    ('corrections.html', 'Corrections', ''), ('privacy.html', 'Privacy', ''),
    ('privacy.html#analytics', 'Analytics choices', ' data-analytics-choices'),
]
# Optional homepage footer only; these supporting pages never enter Menu.
RESEARCH_FOOTER_LINKS = [
    ('questions.html#questions', 'Six questions worth asking'),
    ('evidence.html#records', 'Evidence & original sources'),
    ('understand.html#budget', 'School finances & closure costs'),
    ('options.html#options', 'Ways to keep Kew open'),
    ('lessons.html#key-lessons', 'Historical school cases'),
]

ARCHIVE_BANNER = ('<!-- archive:start --><aside class="archive-banner" aria-label="Archived page"><p><strong>Archived 13 October 2026.</strong> '
                  'This page is no longer updated, so dates and actions here may be out of date. '
                  '<a href="dates.html">Current dates</a> · <a href="get-involved.html">Get involved</a></p></aside><!-- archive:end -->')
# Sticky-bar label, so arrivals at a deep link still see that the page is archived.
ARCHIVE_FLAG = '<span class="archive-flag">Archived</span>'
# Explicit destinations avoid navigation generated from hidden templates or every source card.
# Core/task pages have no section chooser; longer research and archives keep theirs.
SECTIONS = {
    'rally.html': [('when-and-where','Past event'),('schedule','Advertised schedule'),('attending','Original access notes'),('photos','Photo choices'),('council-and-response','Council and your response'),('updates','Questions or corrections')],
    'index.html': [('find-your-way','Find what you need'),('research-shortcut','Historical research','find-your-way'),('quick-answers','Before you respond'),('visit-school','Considering Kew Riverside Primary School?')],
    'evidence.html': [('records','Current Kew findings'),('london-findings','Lessons from other schools','records'),('finding-st-john','St John the Divine','records'),('finding-linked-schools','Fenstanton & Holy Trinity','records'),('finding-pooles','Pooles Park','records'),('source-search','Find a source'),('source-library','Original sources','source-search'),('evidence','Numbers behind the proposal'),('timeline','Dates and next steps'),('earlier-record','Earlier public record'),('gaps','Archived questions'),('method','Method and limits')],
    'options.html': [('options-findings-title','What an alternative needs'),('options-navigation','Assess alternatives'),('option-recovery-plan','A costed alternative','options-navigation'),('option-crowdfunding','Funding','options-navigation'),('option-demand','Pupil demand','options-navigation'),('option-5','Closure costs','options-navigation'),('option-6',"Children’s needs",'options-navigation'),('option-8','Legal experience','options-navigation'),('options-sources-title','Evidence and next steps')],
    'proposal.html': [('council-documents','Council timetable and documents'),('parent-plan','Parent action plan'),('plan-share','Evidence and letters','parent-plan'),('plan-respond','Your response','parent-plan'),('plan-keep-going','More ways to help','parent-plan'),('past-parent-events','Past events'),('timetable','Timeline'),('questions','Questions worth asking'),('question-continuity',"Your child’s next school",'questions'),('question-learning',"Your child’s learning",'questions'),('question-budget','The budget','questions'),('question-closure-costs','Closure costs','questions'),('question-demand','Pupil forecasts','questions'),('question-alternatives','Alternatives','questions'),('who-decides','Who decides'),('other-schools','Lessons from other schools'),('decision-record','Decision record'),('take-part','Official response routes')],
    'understand.html': [('supporting-research','Supporting research'),('pupil-trends','Pupil numbers'),('forecast-checks','Forecast checks'),('school-places','Unfilled places'),('year-groups','Year groups'),('budget','School finances'),('closure-costs','Closure costs','budget'),('other-proposals','Other Richmond proposals'),('learning-and-results','Learning and results'),('inspection-summary','Inspection findings','learning-and-results'),('mixed-age-curriculum','Mixed-age learning','learning-and-results'),('methodology','Method and limits')],
    'faq.html': [('taking-part','Ways to help'),('decisions','Dates and decisions'),('money','Money'),('school-places','School places'),('learning','Learning and results')],
    'lessons.html': [('key-lessons','Key lessons'),('visual-guide','Visual guide'),('catalogue','All 16 schools'),('method','Method and limits')],
    'lessons-sources.html': [('source-register','Source register'),('claim-ledger','Evidence and interpretation')],
    # The short video page needs no section list beside the Menu.
    'supporters.html': [('supporter-form','Supporter statement'),('supporter-list-section','Confirmed supporters')],
}

def render_identity(name, document):
    """Keep publisher identity in generated and maintained pages alike."""
    esc = html.escape
    titles = {
        'index.html': SITE_NAME,
        'letters.html': 'Community letters',
        'about.html': 'About & contact',
        'dates.html': 'Kew Riverside Primary School closure proposal: dates, leaflet and FAQs',
        'get-involved.html': 'Get involved: help keep Kew Riverside Primary School open',
        'updates.html': 'Campaign updates',
        'proposal.html': 'Kew Riverside Primary School closure proposal: consultation and dates',
        'understand.html': 'School finances, pupil numbers and results',
        'questions.html': 'Six questions worth asking about Kew Riverside',
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
        'index.html': 'Help keep Kew Riverside Primary School open. Respond to the council, sign the petition and find the council’s own dates and documents.',
        'dates.html': 'The council’s own timetable for the proposed closure of Kew Riverside Primary School, with its consultation leaflet and FAQs. Closure is proposed, not decided.',
        'get-involved.html': 'Ways to help keep Kew Riverside Primary School open: sign the petition, write to your representatives and share your story.',
        'updates.html': 'News from the parent-led campaign to keep Kew Riverside Primary School open, newest first.',
        'about.html': 'Who runs this independent parent-led campaign website, how to contact the campaign, and guidance for journalists.',
        'proposal.html': 'Understand the proposed closure of Kew Riverside Primary School, the consultation process, who decides and the parent action plan. Responses are due by 16 October 2026.',
        'faq.html': 'Answers for families about the Kew Riverside Primary School closure proposal, consultation, school places and how to respond, with links to official sources.',
        'understand.html': 'Dated school finances, pupil-number comparisons and educational evidence, with sources, forecasts and limitations.',
        'questions.html': 'Six questions about children, learning, finances, closure costs, pupil demand and alternatives, with evidence and original sources.',
        'evidence.html': 'Evidence for challenging the proposed closure of Kew Riverside Primary School: alternatives, full costs, children’s needs and questions for the council, with original sources to check.',
        'options.html': 'Explore alternatives to closing Kew Riverside Primary School and the evidence needed to assess them.',
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
    # Campaign profiles are a separate action from school visits and videos.
    tiktok = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.7 1h-4.1v15.1a3.3 3.3 0 1 1-2.8-3.3V8.6a7.5 7.5 0 1 0 6.9 7.5V8.5a10.4 10.4 0 0 0 6.1 2V6.3A6.2 6.2 0 0 1 16.7 1z"/></svg>'
    x = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932zm-1.29 19.49h2.039L6.487 3.24H4.3z"/></svg>'
    socials = '<!-- footer-socials:start --><section class="wrap footer-socials" aria-labelledby="campaign-socials-title"><h2 id="campaign-socials-title">Amplify the campaign on our socials</h2><p>Follow, like and share our campaign posts.</p><div class="footer-social-links"><a href="https://www.tiktok.com/@savekrps">'+tiktok+'<span>TikTok</span></a><a href="https://x.com/SaveKRPS">'+x+'<span>X</span></a></div></section><!-- footer-socials:end -->'
    # Independent parent videos and school visits have distinct labels; this row
    # never carries petition or closure-campaign requests.
    youtube = '<svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true" focusable="false"><rect width="28" height="20" rx="5" fill="currentColor"/><path d="M11 5.5v9l8-4.5z" fill="var(--theme-background, var(--paper, #fbfaf6))"/></svg>'
    row = '<!-- footer-discovery:start --><div class="wrap footer-discovery"><a class="footer-youtube" href="https://www.youtube.com/@KewParentVoices">'+youtube+'<span>Parent Voices on YouTube</span></a><a class="footer-open-days" href="https://docs.google.com/forms/d/e/1FAIpQLSfwTdpsQB5HOlbJxumjINzFjWiZZCshEHUIrkgXlUDCBBPGrw/viewform">Visit our Open Days <span aria-hidden="true">↗&#xFE0E;</span></a></div><!-- footer-discovery:end -->'
    document = re.sub(r'<!-- footer-discovery:start -->.*?<!-- footer-discovery:end -->', '', document, flags=re.S)
    document = re.sub(r'<!-- footer-socials:start -->.*?<!-- footer-socials:end -->', '', document, flags=re.S)
    document = document.replace('</footer>', socials+row+'</footer>')
    link = '<link rel="stylesheet" href="footer-links.css?v=2026102001">'
    document = re.sub(r'<link rel="stylesheet" href="footer-links\.css(?:\?v=\d+)?">', '', document)
    document = document.replace('<link rel="stylesheet"',link+'<link rel="stylesheet"',1)
    return document

def render_archive(name, document):
    """Archived pages carry a banner as the first child of <main> and noindex."""
    # A distinct value, so pages that set their own noindex (sent.html) keep it.
    robots = '<meta name="robots" content="noindex,follow">'
    document = re.sub(r'<!-- archive:start -->.*?<!-- archive:end -->', '', document, flags=re.S)
    document = document.replace(robots, '')
    if name not in ARCHIVED_PAGES:
        if name in SUPPORTING_PAGES:
            document = re.sub(r'(<div class="independent-bar"><div class="wrap">)<span>[^<]*</span>', r'\1<span>Supporting research</span>', document, count=1)
        return document
    document = re.sub(r'(<main\b[^>]*>)', lambda m: m.group(1)+ARCHIVE_BANNER, document, count=1)
    # The wide-screen status strip would otherwise still say 'updated' above the banner.
    document = re.sub(r'(<div class="independent-bar"><div class="wrap">)<span>[^<]*</span>', r'\1<span>Archived 13 October 2026</span>', document, count=1)
    # Keep an existing stricter policy (the fundraising briefs use noindex,nofollow).
    if not re.search(r'<meta name="robots" content="[^"]*noindex', document.split('</head>', 1)[0]):
        document = document.replace('</head>', robots+'</head>', 1)
    return document

def render_home_navigation(document):
    """Owner-approved compact homepage; other pages retain the shared shell.
    Its Menu lists exactly the same entries as every other page (13 October 2026)."""
    document = render_identity('index.html', document)
    document = re.sub(r'navigation\.js\?v=\d+', 'navigation.js?v='+VERSION, document)
    groups = []
    for index, (heading, entries) in enumerate(MENU_GROUPS, 1):
        links = ''.join('<a href="'+html.escape(href, quote=True)+'"'+(' aria-current="page"' if href == 'index.html' else '')+'>'+html.escape(label)+'</a>' for href,label,kind in entries)
        groups.append('<div class="menu-group" role="group" aria-labelledby="menu-group-'+str(index)+'"><p class="menu-group-label" id="menu-group-'+str(index)+'">'+html.escape(heading)+'</p>'+links+'</div>')
    menu = '<details class="mobile-menu" id="menu" name="site-navigation"><summary>Menu <span aria-hidden="true">⌄</span></summary><nav class="desktop-explore" aria-label="All website pages">'+''.join(groups)+'</nav></details>'
    document = re.sub(r'<details class="mobile-menu" id="menu"[^>]*>.*?</details>', lambda _:menu, document, count=1, flags=re.S)
    footer = ''.join('<a href="'+html.escape(href, quote=True)+'"'+extra+'>'+html.escape(label)+'</a>' for href,label,extra in FOOTER_LINKS)
    document = re.sub(r'(<nav class="home-footer-links"[^>]*>).*?(</nav>)',lambda m:m.group(1)+footer+m.group(2),document,count=1,flags=re.S)
    research_links = ''.join('<a href="'+html.escape(href, quote=True)+'">'+html.escape(label)+'</a>' for href, label in RESEARCH_FOOTER_LINKS)
    research = '<details id="supporting-research"><summary>Supporting research &amp; alternatives <span aria-hidden="true">＋</span></summary><div class="disclosure-content"><nav aria-label="Supporting research and alternatives">'+research_links+'</nav></div></details>'
    document = re.sub(r'\n? *<details id="supporting-research">.*?</details>', '', document, flags=re.S)
    settings = re.search(r'<details id="site-settings">.*?</details>', document, re.S)
    if settings:
        document = document[:settings.end()]+'\n      '+research+document[settings.end():]
    return render_footer_discovery(document)

def render_navigation(name, document):
    if name not in PAGE_LABELS or 'class="site-header"' not in document:
        return document
    if name == 'index.html' and 'data-home-landing' in document:
        return render_home_navigation(document)
    document = render_identity(name, document)
    document = render_archive(name, document)
    page_versions = {'letters.js': '2026101903', 'community.css': '2026101902'} if name == 'letters.html' else {}
    for asset in ('letters.js', 'contribute.css', 'feedback.css', 'community.css', 'discovery.css'):
        version = page_versions.get(asset, VERSION)
        document = re.sub(re.escape(asset)+r'\?v=\d+', asset+'?v='+version, document)
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
    # One wide-screen shortcut to the main campaign actions; the Menu holds the rest.
    current = ' aria-current="page"' if name == 'get-involved.html' else ''
    desktop_html = '<nav class="desktop-explore" aria-label="Explore the website"><a href="get-involved.html" class="nav-primary"'+current+'>Get involved</a></nav>'
    header = re.sub(r'<nav class="desktop-explore".*?</nav>', desktop_html, header, flags=re.S)
    # The header tiles (Community letters / Share ideas) were retired with the
    # slim site; Get involved and the footer carry those routes.
    header = re.sub(r'\n?<nav class="participation-nav".*?</nav>', '', header, flags=re.S)
    # The Menu is chosen, not generated from every page label.
    def menu_link(href, label, kind=''):
        current = ' aria-current="page"' if href.split('#')[0] == name and kind == '' else ''
        cls = ' class="nav-subitem"' if kind == 'sub' else ''
        return f'<a href="{esc(href)}"{cls}{current}>{esc(label)}</a>'
    groups = []
    for index, (heading, entries) in enumerate(MENU_GROUPS, 1):
        entries = list(entries)
        if index == 1 and name == 'sent.html':
            entries.append(('sent.html', 'Next steps', ''))
        links = ''.join(menu_link(*entry) for entry in entries)
        groups.append(f'<div class="menu-group" role="group" aria-labelledby="menu-group-{index}"><p class="menu-group-label" id="menu-group-{index}">{esc(heading)}</p>{links}</div>')
    status = re.search(r'<div class="independent-bar"><div class="wrap">(.*?)</div></div>', document, re.S)
    # Archived pages' dated status strips would contradict the archive banner.
    mobile_status = '<div class="mobile-page-note"><p class="menu-group-label">Page information</p>'+status.group(1)+'</div>' if status and name not in ARCHIVED_PAGES else ''
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
    flag = ARCHIVE_FLAG if name in ARCHIVED_PAGES else ''
    orientation = '<!-- orientation:start --><div class="site-orientation"><div class="wrap orientation-inner"><span class="page-name">'+esc(PAGE_LABELS[name])+'</span>'+flag+section_html+menu+'</div></div><!-- orientation:end -->'
    header = header.replace('</header>',orientation+'</header>')
    document = document[:match.start()]+header+document[match.end():]
    footer_links = ''.join(f'<a href="{esc(href)}"{extra}>{esc(label)}</a>' for href, label, extra in FOOTER_LINKS)
    # Remove the two appended footer sections while rewriting the link list;
    # render_footer_discovery restores both afterwards.
    document = re.sub(r'<!-- footer-discovery:start -->.*?<!-- footer-discovery:end -->', '', document, flags=re.S)
    document = re.sub(r'<!-- footer-socials:start -->.*?<!-- footer-socials:end -->', '', document, flags=re.S)
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
