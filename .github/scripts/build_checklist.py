"""Build response-checklist.pdf from Markdown in this checkout.

Requires ReportLab. Render and inspect both pages before staging the PDF.
"""

from pathlib import Path
import os
import re
from urllib.parse import urlsplit
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak, Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

SITE = Path(__file__).resolve().parents[2]
source = (SITE / 'response-checklist.md').read_text()
PUBLIC_BASE = 'https://savekewriversideprimaryschool.org/'
INK = colors.HexColor('#183733')
TEAL = colors.HexColor('#0e6470')
MUTED = colors.HexColor('#4b625c')
LINE = colors.HexColor('#c5d1c3')
FONT_DIRS = [
    Path(os.environ['LIBERATION_FONT_DIR']) if os.environ.get('LIBERATION_FONT_DIR') else None,
    Path('/usr/share/fonts/truetype/liberation2'),
    Path('/usr/share/fonts/truetype/liberation'),
    Path('/Library/Fonts'),
]
FONT_DIR = next((directory for directory in FONT_DIRS
                 if directory and (directory / 'LiberationSans-Regular.ttf').is_file()
                 and (directory / 'LiberationSans-Bold.ttf').is_file()
                 and (directory / 'LiberationSerif-Regular.ttf').is_file()), None)
if FONT_DIR:
    pdfmetrics.registerFont(TTFont('KewSans', str(FONT_DIR / 'LiberationSans-Regular.ttf')))
    pdfmetrics.registerFont(TTFont('KewSans-Bold', str(FONT_DIR / 'LiberationSans-Bold.ttf')))
    pdfmetrics.registerFont(TTFont('KewSerif', str(FONT_DIR / 'LiberationSerif-Regular.ttf')))
    pdfmetrics.registerFontFamily('KewSans', normal='KewSans', bold='KewSans-Bold')
FONT_SANS = 'KewSans' if FONT_DIR else 'Helvetica'
FONT_BOLD = 'KewSans-Bold' if FONT_DIR else 'Helvetica-Bold'
FONT_SERIF = 'KewSerif' if FONT_DIR else 'Times-Roman'

date_match = re.search(r'(?:Research checked|Budget and forecast update checked|Checked)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})', source)
if not date_match:
    raise ValueError('Checklist source needs a visible checked date.')
CHECKED_DATE = date_match.group(1)

def clean(text):
    return text.replace('\u2013', '-').replace('\u2014', '-').replace('\u2011', '-').replace('\u2019', "'")

def rich(text):
    """Allow simple Markdown links while escaping all other author-supplied text."""
    pieces = []
    offset = 0
    for match in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', text):
        pieces.append(escape(clean(text[offset:match.start()])))
        label, raw_url = match.groups()
        url = PUBLIC_BASE + raw_url if not urlsplit(raw_url).scheme else raw_url
        if not url.startswith('https://'):
            raise ValueError('Only HTTPS checklist links are supported.')
        pieces.append(f'<a href="{escape(url, {chr(34): "&quot;"})}" color="#0e6470">{escape(clean(label))}</a>')
        offset = match.end()
    pieces.append(escape(clean(text[offset:])))
    return ''.join(pieces).replace('\n', ' ')

def section(name):
    match = re.search(r'^## ' + re.escape(name) + r'\n(.*?)(?=^## |\Z)', source, re.M | re.S)
    if not match: raise ValueError(name)
    return match.group(1).strip()

styles = {
    'title': ParagraphStyle('title', fontName=FONT_SERIF, fontSize=27, leading=30, textColor=INK, spaceAfter=13),
    'subtitle': ParagraphStyle('subtitle', fontName=FONT_BOLD, fontSize=9, leading=12, textColor=TEAL, spaceAfter=9),
    'body': ParagraphStyle('body', fontName=FONT_SANS, fontSize=10.2, leading=13.8, textColor=INK, spaceAfter=6),
    'small': ParagraphStyle('small', fontName=FONT_SANS, fontSize=9, leading=12, textColor=MUTED, spaceAfter=7),
    'heading': ParagraphStyle('heading', fontName=FONT_BOLD, fontSize=14, leading=18, textColor=INK, spaceBefore=14, spaceAfter=9),
    'url': ParagraphStyle('url', fontName=FONT_SANS, fontSize=8.4, leading=11, textColor=TEAL, spaceAfter=6, wordWrap='CJK'),
}
def para(text, style='body'):
    return Paragraph(rich(text), styles[style])

class Check(Flowable):
    def __init__(self, text):
        super().__init__()
        self.paragraph = Paragraph(clean(text), styles['body'])
        self.spaceAfter = 6
    def wrap(self, width, height):
        self.width = width
        _, self.height = self.paragraph.wrap(width - 20, height)
        return width, self.height
    def draw(self):
        self.canv.setStrokeColor(TEAL)
        self.canv.setLineWidth(.8)
        self.canv.rect(0, self.height - 10.5, 8, 8)
        self.paragraph.drawOn(self.canv, 20, 0)

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.page_states = []

    def showPage(self):
        self.page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self.page_states)
        for state in self.page_states:
            self.__dict__.update(state)
            self.setFont(FONT_SANS, 8)
            self.setFillColor(MUTED)
            self.drawRightString(A4[0] - 44, 26, f'Page {self._pageNumber} of {total}')
            super().showPage()
        super().save()

def footer(canvas, doc):
    w, _ = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(.5)
    canvas.line(44, 39, w - 44, 39)
    canvas.setFont(FONT_SANS, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(44, 26, f'Yann Stoneman | Kew Riverside Primary School | Checked {CHECKED_DATE}')

story = [para('KEW RIVERSIDE PRIMARY SCHOOL / PARENT-LED EVIDENCE & ACTION', 'subtitle'),
         para('Consultation response checklist', 'title'),
         para(source.split('\n\n')[1], 'small'),
         para('Before submitting', 'heading')]
before = section('Before submitting')
for line in before.split('\n'):
    if line.startswith('- ') and not re.match(r'^- [^:]+: https://', line):
        story.append(Check(rich(line[2:])))
story.append(para('Build a concise case', 'heading'))
case = section('Build a concise case')
for title, body in re.findall(r'^### ([^\n]+)\n(.+?)(?=\n### |\Z)', case, re.M | re.S):
    story.append(Check('<b>' + rich(title) + '</b><br/>' + rich(body.strip())))
story += [PageBreak(), para('Write and submit your response', 'title'), para('Suggested response structure', 'heading')]
for line in section('Response structure').split('\n'):
    match = re.match(r'\d+\. (.+)', line)
    if match: story.append(Check(rich(match.group(1))))

story.append(para('Official starting points', 'heading'))
story.append(para('Check the official response form for the latest deadline and any updates before submitting.', 'small'))
for label, url in re.findall(r'^- ([^:\n]+): (https://\S+)', before, re.M):
    story.append(Paragraph('<b>' + escape(label) + '</b>', styles['body']))
    story.append(Paragraph('<a href="' + escape(url, {'"': '&quot;'}) + '" color="#0e6470">' + escape(url) + '</a>', styles['url']))

story.append(para('Other participation routes', 'heading'))
other = section('Other participation routes')
for block in other.split('\n\n'):
    lines = block.split('\n')
    if len(lines) == 2 and lines[1].startswith('https://'):
        story.append(para(lines[0], 'small'))
        story.append(Paragraph('<a href="' + escape(lines[1], {'"': '&quot;'}) + '" color="#0e6470">' + escape(lines[1]) + '</a>', styles['url']))
    else:
        story.append(para(block, 'small'))
story.append(para('Keep your source details', 'heading'))
for block in section('Source control').split('\n\n'):
    story.append(para(block, 'small'))

output = SITE / 'response-checklist.pdf'
doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=44, leftMargin=44, topMargin=38, bottomMargin=51,
    title='Kew Riverside Primary School: consultation response checklist', author='Yann Stoneman',
    subject='Parent-prepared evidence checklist for a consultation response')
doc.build(story, onFirstPage=footer, onLaterPages=footer, canvasmaker=NumberedCanvas)
print(output)
