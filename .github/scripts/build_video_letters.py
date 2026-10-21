"""Keep no-script written/video letters synchronized with the validated public feed."""
import argparse
import datetime as dt
import html
import json
import re
from pathlib import Path
from public_data import validate_board

ROOT = Path(__file__).resolve().parents[2]
START = '<!-- video-letters-fallback:start -->'
END = '<!-- video-letters-fallback:end -->'

def render_fallback(board, source_ids=()):
    validate_board(board, 'letters')
    entries = []
    # Match letters.js: later appended entries lead same-day ties.
    newest_first = sorted(reversed(board['letters']), key=lambda row: row['date'], reverse=True)
    for row in newest_first:
        esc = html.escape
        date = dt.date.fromisoformat(row['date']).strftime('%d %B %Y')
        letter_url = f'https://savekewriversideprimaryschool.org/letters.html#{row["id"]}'
        kind = 'Video letter' if 'youtubeId' in row else 'Community letter'
        video = f'<p><a href="https://www.youtube.com/watch?v={row["youtubeId"]}">Watch on YouTube</a></p>' if 'youtubeId' in row else ''
        sources = f'<p><a href="#sources-{row["id"]}">Supporting note and sources</a></p>' if row['id'] in source_ids else ''
        entries.append(f'<article class="suggestion-card letter-card" id="{row["id"]}"><h3 class="public-author">{esc(row["displayName"])}</h3>'
                       f'<p>{kind} · {esc(row["review"])} · Opinion · <time datetime="{row["date"]}">{date}</time></p>'
                       f'<p class="suggestion-body">{esc(row["body"]).replace(chr(10), "&#10;")}</p>'
                       f'<div class="letter-source"><p>Published on Save Kew Riverside Primary School Campaign · Independent and parent-led</p>'
                       f'<div class="letter-source-actions"><a class="letter-permalink" href="{letter_url}" aria-label="savekewriversideprimaryschool.org — Permanent link to the {kind.lower()} by {esc(row["displayName"], quote=True)}">savekewriversideprimaryschool.org</a></div>'
                       f'<p class="letter-print-url">{letter_url}</p></div>'
                       f'{sources}{video}'
                       f'<a href="feedback.html?kind=privacy&amp;letter={row["id"]}#feedback-form">Report this {kind.lower()} or request removal</a></article>')
    return '\n' + '\n'.join(entries) + '\n'

def build(root=ROOT, check=False):
    root = Path(root)
    page = root / 'letters.html'
    current = page.read_text()
    if current.count(START) != 1 or current.count(END) != 1:
        raise ValueError('Expected one static video-letter fallback block.')
    prefix, rest = current.split(START, 1)
    _, suffix = rest.split(END, 1)
    source_ids = re.findall(r'id="sources-(letter-[a-f0-9]{12})"', current)
    result = prefix + START + render_fallback(json.loads((root / 'letters.json').read_text()), source_ids) + END + suffix
    if check:
        if result != current: raise ValueError('Static video-letter links are stale.')
    elif result != current:
        page.write_text(result)
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    build(check=args.check)
    print('Static written/video letters match the public feed.')
