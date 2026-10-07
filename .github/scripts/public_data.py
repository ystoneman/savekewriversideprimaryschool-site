"""Fail-closed schemas for the only submission data permitted on the public site.

These checks cannot establish consent or detect all personal details in free text.
The private moderation workflow must establish consent and the stated review.
"""
import datetime as dt
import re

STATEMENT = 'We support keeping Kew Riverside Primary School open.'
STATEMENT_VERSION = 'keep-open-2026-09-21'


def validate_board(board, kind):
    if kind not in {'suggestions', 'letters', 'supporters'}:
        raise ValueError('Unknown public board.')
    top = {'version', kind}
    if kind == 'supporters':
        top |= {'statement', 'statementVersion'}
    if not isinstance(board, dict) or set(board) != top or type(board['version']) is not int or board['version'] != 1 or not isinstance(board[kind], list):
        raise ValueError('Unexpected public board fields or version.')
    if kind == 'supporters' and (board['statement'] != STATEMENT or board['statementVersion'] != STATEMENT_VERSION):
        raise ValueError('Unexpected supporter statement.')
    prefix = {'suggestions': 'idea', 'letters': 'letter', 'supporters': 'supporter'}[kind]
    allowed_reviews = {
        'suggestions': {'AI reviewed'},
        'letters': {'Human reviewed', 'AI screened'},
        'supporters': {'Confirmed with contributor; human reviewed'},
    }[kind]
    required = {'id', 'date', 'review'}
    required |= {'displayName'} if kind == 'supporters' else {'body'}
    if kind == 'letters': required.add('displayName')
    if kind == 'suggestions': required.add('status')
    allowed = required | {'displayName'}
    seen = set()
    for row in board[kind]:
        if not isinstance(row, dict) or not required <= set(row) <= allowed or any(not isinstance(v, str) for v in row.values()):
            raise ValueError('Unexpected public record fields or types; private data must never be published.')
        if not re.fullmatch(prefix + r'-[a-f0-9]{12}', row['id']) or row['id'] in seen:
            raise ValueError('Invalid or duplicate public ID.')
        seen.add(row['id'])
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', row['date']):
            raise ValueError('Invalid public date.')
        dt.date.fromisoformat(row['date'])
        if row['review'] not in allowed_reviews or (kind == 'suggestions' and row['status'] != 'Received'):
            raise ValueError('Invalid public review status.')
        if 'body' in row:
            # Letters match the browser's native maxlength / JavaScript length.
            length = len(row['body'].encode('utf-16-le', errors='surrogatepass')) // 2 if kind == 'letters' else len(row['body'].strip())
            minimum = len(row['body'].strip().encode('utf-16-le', errors='surrogatepass')) // 2 if kind == 'letters' else length
            if minimum < 10 or length > (30000 if kind == 'letters' else 3000):
                raise ValueError('Invalid public message length.')
        if 'displayName' in row and not (2 if kind == 'supporters' else 1) <= len(row['displayName'].strip()) <= 60:
            raise ValueError('Invalid public name length.')
        for field in ('body', 'displayName'):
            if field in row and (re.search(r'@|https?://|www\.|[<>]', row[field], re.I) or any(ord(c) < 32 and c not in '\n\t' for c in row[field])):
                raise ValueError('Contact details, links, markup or controls need operator reconciliation before publication.')
    return board
