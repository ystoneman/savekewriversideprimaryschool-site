import copy
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from check_site import CSP, Page, PUBLIC_FILES, ROOT, stage_site, validate_site
from public_data import STATEMENT, STATEMENT_VERSION, validate_board


def fixture(kind):
    prefix = {'suggestions': 'idea', 'letters': 'letter', 'supporters': 'supporter'}[kind]
    review = {'suggestions': 'AI reviewed', 'letters': 'Human reviewed', 'supporters': 'Confirmed with contributor; human reviewed'}[kind]
    row = {'id': prefix + '-0123456789ab', 'date': '2026-09-21', 'review': review, 'displayName': 'Example neighbour'}
    if kind != 'supporters': row['body'] = 'Please keep the community informed about the next meeting.'
    if kind == 'suggestions': row['status'] = 'Received'
    board = {'version': 1, kind: [row]}
    if kind == 'supporters': board.update(statement=STATEMENT, statementVersion=STATEMENT_VERSION)
    return board


class PublicDataTests(unittest.TestCase):
    def test_valid_boards_and_legacy_anonymous_suggestion(self):
        for kind in ('suggestions', 'letters', 'supporters'):
            validate_board(fixture(kind), kind)
        old = fixture('suggestions'); old['suggestions'][0].pop('displayName')
        validate_board(old, 'suggestions')

    def test_private_fields_at_either_level_fail_closed(self):
        for kind in ('suggestions', 'letters', 'supporters'):
            for key in ('email', 'council_name', 'council_postcode', 'queue_key', 'approval_reference'):
                for at_root in (True, False):
                    board = fixture(kind)
                    (board if at_root else board[kind][0])[key] = 'fictional private test data'
                    with self.subTest(kind=kind, key=key, root=at_root), self.assertRaises(ValueError):
                        validate_board(board, kind)

    def test_letters_accept_exactly_human_or_ai_screening_labels(self):
        board = fixture('letters')
        screened = copy.deepcopy(board['letters'][0])
        screened.update(id='letter-abcdef012345', review='AI screened')
        board['letters'].append(screened)
        self.assertEqual(validate_board(board, 'letters'), board)
        for review in ('AI reviewed', 'ai screened', 'Human reviewed ', 'Approved', '', None):
            bad = fixture('letters'); bad['letters'][0]['review'] = review
            with self.subTest(review=review), self.assertRaises(ValueError):
                validate_board(bad, 'letters')
        for kind in ('suggestions', 'supporters'):
            bad = fixture(kind); bad[kind][0]['review'] = 'AI screened'
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                validate_board(bad, kind)

    def test_letter_limit_is_30000_utf16_units_without_changing_suggestions(self):
        for review in ('Human reviewed', 'AI screened'):
            for body in ('F' * 30000, 'F' * 29998 + '🙂'):
                board = fixture('letters'); board['letters'][0].update(body=body, review=review)
                with self.subTest(review=review, emoji=body.endswith('🙂')):
                    self.assertEqual(validate_board(board, 'letters')['letters'][0]['body'], body)
        for body in ('F' * 30001, 'F' * 29999 + '🙂', 'F' * 30000 + ' '):
            board = fixture('letters'); board['letters'][0]['body'] = body
            with self.subTest(length=len(body), emoji=body.endswith('🙂')), self.assertRaises(ValueError):
                validate_board(board, 'letters')
        suggestion = fixture('suggestions'); suggestion['suggestions'][0]['body'] = 'F' * 3000
        validate_board(suggestion, 'suggestions')
        suggestion['suggestions'][0]['body'] += 'F'
        with self.assertRaises(ValueError): validate_board(suggestion, 'suggestions')

    def test_long_letters_still_reject_private_fields_and_markup(self):
        for patch in ({'email': 'private@example.invalid'}, {'body': '<strong>Fictional</strong>'.ljust(30000, 'F')}):
            board = fixture('letters'); board['letters'][0]['body'] = 'F' * 30000
            board['letters'][0].update(patch)
            with self.subTest(field=next(iter(patch))), self.assertRaises(ValueError):
                validate_board(board, 'letters')

    def test_duplicates_invalid_types_dates_review_and_markup_rejected(self):
        for kind in ('suggestions', 'letters', 'supporters'):
            for patch in ({'id': '../invalid'}, {'date': '2026-02-31'}, {'review': 'Approved'}, {'displayName': {'email': 'test@example.invalid'}}, {'displayName': '<svg onload=alert(1)>'}):
                board = fixture(kind); board[kind][0].update(patch)
                with self.subTest(kind=kind, patch=patch), self.assertRaises(ValueError): validate_board(board, kind)
            board = fixture(kind); board[kind].append(copy.deepcopy(board[kind][0]))
            with self.assertRaises(ValueError): validate_board(board, kind)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(); self.addCleanup(temp.cleanup)
        self.base = Path(temp.name); self.root = self.base / 'site'; self.root.mkdir()
        for name in PUBLIC_FILES:
            (self.root / name).parent.mkdir(parents=True, exist_ok=True)
            if name in {'letters.json', 'suggestions.json', 'supporters.json'}:
                (self.root / name).write_text(json.dumps(fixture(Path(name).stem)))
            else:
                shutil.copyfile(ROOT / name, self.root / name)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)

    def test_stage_contains_only_intended_public_assets(self):
        (self.root / 'README.md').write_text('Maintenance notes')
        stage_site(self.base / 'output', self.root)
        self.assertEqual({p.relative_to(self.base / 'output').as_posix()
                          for p in (self.base / 'output').rglob('*') if p.is_file()}, PUBLIC_FILES)

    def test_raw_inbox_or_unknown_file_stops_deployment(self):
        (self.root / 'intake.json').write_text('{}')
        with self.assertRaises(ValueError): stage_site(self.base / 'output', self.root)
        self.assertFalse((self.base / 'output').exists())

    def test_bad_board_stops_deployment_even_when_browser_would_hide_field(self):
        board = fixture('letters'); board['letters'][0]['email'] = 'test@example.invalid'
        (self.root / 'letters.json').write_text(json.dumps(board))
        with self.assertRaises(ValueError): validate_site(self.root)

    def test_symlink_stops_deployment(self):
        (self.base / 'private').write_text('private')
        (self.root / 'letters.json').unlink()
        (self.root / 'letters.json').symlink_to(self.base / 'private')
        with self.assertRaises(ValueError): validate_site(self.root)

    def test_disabled_private_fields_and_csp_are_required(self):
        p = self.root / 'letters.html'; p.write_text(p.read_text().replace('id="council-name" disabled', 'id="council-name"'))
        with self.assertRaises(ValueError): validate_site(self.root)
        with self.assertRaises(ValueError): Page('<script src="app.js"></script>')
        with self.assertRaises(ValueError): Page('<meta http-equiv="Content-Security-Policy" content="' + CSP + '"><img src="favicon.svg" onerror="alert(1)">')

    def test_letter_notice_and_separate_permissions_are_enforced(self):
        p = self.root / 'letters.html'; original = p.read_text()
        for before, after in (
            ('2026-09-22-letters-v3', '2026-09-21-v2'),
            ('yes-process-my-letter-v3', 'yes-process-my-letter-v2'),
            ('yes-publish-with-display-name-v3', 'yes-publish-with-display-name-v2'),
            ('yes-share-with-richmond-council-v2', 'yes-share-with-richmond-council-v3'),
            ('type="checkbox" required value="yes-process-my-letter-v3"', 'type="checkbox" value="yes-process-my-letter-v3"'),
            ('name="allow_public" type="checkbox"', 'name="allow_public" type="checkbox" required'),
            ('name="allow_council" type="checkbox"', 'name="allow_council" type="checkbox" required'),
            ('yes-quote-published-letter-v1', 'yes-quote-published-letter-v2'),
            ('name="allow_quotes" type="checkbox"', 'name="allow_quotes" type="checkbox" required'),
            ('name="allow_quotes" type="checkbox"', 'name="allow_quotes" type="checkbox" checked'),
        ):
            self.assertIn(before, original)
            p.write_text(original.replace(before, after))
            with self.subTest(change=after), self.assertRaises(ValueError):
                validate_site(self.root)
        p.write_text(original)

    def test_script_versions_cannot_escape_public_asset_allowlist(self):
        head = '<meta http-equiv="Content-Security-Policy" content="' + CSP + '"><meta name="referrer" content="strict-origin-when-cross-origin">'
        Page(head + '<script src="navigation.js?v=20260922"></script>')
        for src in ('https://example.invalid/navigation.js?v=1', '//example.invalid/navigation.js',
                    '../navigation.js', 'unreviewed.js?v=1', 'navigation.js?v=1&amp;extra=2',
                    'navigation.js#fragment', 'navigation.js?v=not-a-version'):
            with self.subTest(src=src), self.assertRaises(ValueError):
                Page(head + '<script src="' + src + '"></script>')

    def test_stylesheet_versions_cannot_escape_public_asset_allowlist(self):
        head = '<meta http-equiv="Content-Security-Policy" content="' + CSP + '"><meta name="referrer" content="strict-origin-when-cross-origin">'
        Page(head + '<link rel="stylesheet" href="feedback.css?v=2026092202">')
        for href in ('https://example.invalid/feedback.css?v=1', '//example.invalid/feedback.css',
                     '../feedback.css', 'unreviewed.css?v=1', 'feedback.css?v=1&amp;extra=2',
                     'feedback.css#fragment', 'feedback.css?v=not-a-version', 'letters.js?v=1'):
            with self.subTest(href=href), self.assertRaises(ValueError):
                Page(head + '<link rel="stylesheet" href="' + href + '">')


if __name__ == '__main__': unittest.main()
