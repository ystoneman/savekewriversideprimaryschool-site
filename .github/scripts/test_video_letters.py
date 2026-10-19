import copy
import json
from pathlib import Path
import tempfile
import unittest
from build_video_letters import START, END, build, render_fallback
from check_site import CSP, LETTERS_CSP, Page
from public_data import validate_board
from test_security import fixture

class VideoLetterTests(unittest.TestCase):
    def video(self):
        board = fixture('letters'); board['letters'][0]['youtubeId'] = 'AbC0123_-xy'; return board
    def test_only_strict_video_ids_are_allowed(self):
        validate_board(self.video(), 'letters')
        for bad in ('', 'too-short', 'AbC0123_-xy?autoplay=1', 'https://youtube.com/fictional', '<script>', 123):
            board = self.video(); board['letters'][0]['youtubeId'] = bad
            with self.subTest(bad=bad), self.assertRaises(ValueError): validate_board(board, 'letters')
        board = fixture('suggestions'); board['suggestions'][0]['youtubeId'] = 'AbC0123_-xy'
        with self.assertRaises(ValueError): validate_board(board, 'suggestions')
    def test_static_fallback_is_truthful_escaped_and_text_compatible(self):
        board=self.video(); board['letters'][0]['displayName']='Example & neighbour'
        text=render_fallback(board)
        self.assertIn('Example &amp; neighbour', text); self.assertIn('Video letter · Human reviewed · Opinion', text)
        self.assertIn('watch?v=AbC0123_-xy',text); self.assertIn('kind=privacy&amp;letter=letter-',text)
        self.assertIn('Independent and parent-led', text)
        self.assertIn('https://savekewriversideprimaryschool.org/letters.html#', text)
        self.assertNotIn('<iframe',text); self.assertEqual(render_fallback(fixture('letters')),'\n\n')
    def test_static_fallback_matches_feed_newest_first_order(self):
        board = self.video()
        older = copy.deepcopy(board['letters'][0]); older['id'] = 'letter-000000000001'; older['date'] = '2026-09-01'
        same_day_later = copy.deepcopy(board['letters'][0]); same_day_later['id'] = 'letter-000000000002'
        board['letters'] = [older, board['letters'][0], same_day_later]
        text = render_fallback(board)
        self.assertLess(text.index('letter-000000000002'), text.index(board['letters'][1]['id']))
        self.assertLess(text.index(board['letters'][1]['id']), text.index('letter-000000000001'))
    def test_generated_fallback_cannot_be_stale_or_contain_private_fields(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); (root/'letters.html').write_text('prefix'+START+'\n\n'+END+'suffix'); (root/'letters.json').write_text(json.dumps(self.video()))
            with self.assertRaises(ValueError): build(root, check=True)
            build(root); build(root, check=True)
            board=self.video(); board['letters'][0]['email']='private@example.invalid'; (root/'letters.json').write_text(json.dumps(board))
            with self.assertRaises(ValueError): build(root)
    def test_only_explicit_letters_page_allows_privacy_enhanced_frame(self):
        def page(policy, allowed=False):
            return Page('<meta http-equiv="Content-Security-Policy" content="'+policy+'"><meta name="referrer" content="strict-origin-when-cross-origin">', expected_csp=LETTERS_CSP if allowed else CSP)
        page(CSP)
        with self.assertRaises(ValueError): page(LETTERS_CSP)
        page(LETTERS_CSP,True)
        with self.assertRaises(ValueError): page(LETTERS_CSP.replace('https://www.youtube-nocookie.com','https://www.youtube.com'),True)
        with self.assertRaises(ValueError): Page('<iframe src="https://www.youtube-nocookie.com/embed/AbC0123_-xy"></iframe>',expected_csp=LETTERS_CSP)

if __name__=='__main__': unittest.main()
