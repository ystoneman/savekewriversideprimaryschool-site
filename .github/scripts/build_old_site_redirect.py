"""Build small legacy compatibility sites from the validated canonical allowlist."""
import argparse
import html
import json
from pathlib import Path
import shutil
from check_site import PUBLIC_FILES
ROOT = Path(__file__).resolve().parent
CANONICAL = 'https://savekewriversideprimaryschool.org/'
GENERATED = {'cutover-redirect.js', 'cutover.css', '404.html'}
POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; upgrade-insecure-requests"
LINKS = {
 'index.html': [('proposal.html#parent-plan', 'Parent action plan'), ('evidence.html#records', 'Evidence and sources'), ('letters.html', 'Community letters')],
 'evidence.html': [('evidence.html#source-search', 'Search the sources'), ('evidence.html#records', 'Evidence and sources')],
 'feedback.html': [('feedback.html?kind=privacy#feedback-form', 'Corrections or removal requests'), ('feedback.html#feedback-form', 'Share an idea')],
 'videos.html': [('videos.html#upload', 'Video upload information')],
 'letters.html': [('letters.html#letter-form', 'Write a letter')],
}
def asset_files():
 manifest = json.loads((ROOT / 'compatibility-assets.json').read_text())
 files = manifest['files']
 if manifest.get('version') != 1 or len(files) != len(set(files)) or not set(files) <= PUBLIC_FILES:
  raise ValueError('Invalid compatibility asset allowlist.')
 if any(f.endswith(('.html', '.js', '.css')) for f in files):
  raise ValueError('Full pages, scripts and styles cannot be compatibility mirrors.')
 return set(files)
def page(name):
 recovery = name in {'letters.html', 'sent.html'}
 target = CANONICAL + ('' if name in {'index.html', '404.html'} else name)
 links = ''.join('<li><a href="' + html.escape(CANONICAL + href, quote=True) + '">' + label + '</a></li>' for href, label in LINKS.get(name, []))
 content = '<h1>This website has moved</h1><p>The current website is at savekewriversideprimaryschool.org.</p>'
 if recovery:
  content += ('<section id="letter-form"><h2>Recover words saved in this browser</h2>'
   '<p>Saved words stay at this old address. Copy them, continue to the current website, '
   'paste them into its letter form and choose your permissions there.</p>'
   '<p id="recovery-status" role="status"></p><div id="saved-words"></div>'
   '<button id="clear-drafts" type="button" hidden>Clear saved words</button>'
   '<p>A saved or pending letter does not confirm that a submission arrived. '
   'Check any confirmation you received before submitting it again.</p>'
   '<p id="storage-help">JavaScript is required to read words saved in browser storage. '
   'Enable it at this old address to recover them. You can still continue below.</p></section>')
 content += '<p><a class="cutover-link" href="' + html.escape(target, quote=True) + '">Continue on the current website</a></p>'
 content += '<noscript><p>JavaScript is off. The link opens the corresponding current page; search settings and section fragments are not copied automatically.</p></noscript>'
 if links: content += '<h2>Useful destinations</h2><ul>' + links + '</ul>'
 content += '<p><a href="' + CANONICAL + 'privacy.html">Privacy information</a> · <a href="' + CANONICAL + 'corrections.html">Request a correction or removal</a></p>'
 return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
  '<meta http-equiv="Content-Security-Policy" content="' + POLICY + '">'
  '<meta name="referrer" content="strict-origin-when-cross-origin">'
  '<meta name="viewport" content="width=device-width,initial-scale=1">'
  '<title>Website moved · Kew Riverside</title><link rel="canonical" href="' + target + '">'
  '<link rel="stylesheet" href="cutover.css?v=2026100701">'
  '<script src="cutover-redirect.js?v=2026100701" data-page="' + name + '" defer></script>'
  '</head><body><main>' + content + '</main></body></html>')
def build(source, output):
 source, output = Path(source), Path(output)
 if output.exists(): raise ValueError('Output must be a new directory.')
 entries = list(source.rglob('*'))
 if any(p.is_symlink() for p in entries): raise ValueError('Symlinks are forbidden.')
 files = {p.relative_to(source).as_posix() for p in entries if p.is_file()}
 if files != PUBLIC_FILES: raise ValueError('Input must be exactly the validated public allowlist.')
 assets = asset_files()
 output.mkdir(parents=True)
 for name in sorted(assets | {'visit/index.html'}):
  target = output / name; target.parent.mkdir(parents=True, exist_ok=True)
  shutil.copyfile(source / name, target)
 for name in sorted(f for f in files if f.endswith('.html') and f != 'visit/index.html'):
  (output / name).write_text(page(name))
 (output / '404.html').write_text(page('404.html'))
 shutil.copyfile(ROOT / 'old_site_redirect.js', output / 'cutover-redirect.js')
 shutil.copyfile(ROOT / 'old_site_redirect.css', output / 'cutover.css')
 return sum(p.is_file() for p in output.rglob('*'))
if __name__ == '__main__':
 parser = argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--source', required=True); parser.add_argument('--output', required=True)
 args = parser.parse_args(); print('Built', build(args.source, args.output), 'compatibility files.')
