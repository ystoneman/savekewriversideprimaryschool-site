"""Check current main under the canonical publishing lock; uncertainty blocks publishing."""
import argparse
import json
import os
import re
import urllib.request

REPOSITORY = 'ystoneman/savekewriversideprimaryschool-site'


def eligible(sha, current_main, event='push', ref='refs/heads/main'):
    if not all(isinstance(value, str) and re.fullmatch('[0-9a-f]{40}', value)
               for value in [sha, current_main]):
        raise ValueError('Invalid deployment revision')
    return event == 'push' and ref == 'refs/heads/main' and sha == current_main


def current_main():
    request = urllib.request.Request(
        'https://api.github.com/repos/' + REPOSITORY + '/git/ref/heads/main',
        headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
                 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
                 'User-Agent': 'Kew-deployment-queue', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=15) as response:
        raw = response.read(64 * 1024 + 1)
    if len(raw) > 64 * 1024:
        raise ValueError('Main reference response exceeds limit')
    data = json.loads(raw)
    if data.get('ref') != 'refs/heads/main' or data['object'].get('type') != 'commit':
        raise ValueError('Unexpected main reference')
    return data['object']['sha']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sha', required=True)
    args = parser.parse_args()
    latest = eligible(args.sha, current_main(), os.environ.get('GITHUB_EVENT_NAME'),
                      os.environ.get('GITHUB_REF'))
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('current=' + str(latest).lower() + '\n')
    message = ('Current main revision may publish' if latest else
               'Superseded revision: canonical publication skipped; existing live site retained')
    print(message)
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
        output.write(message + '\n')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # API exception messages may contain sensitive transport details.
        raise SystemExit('Publication guard unavailable (' + type(error).__name__ + ')')
