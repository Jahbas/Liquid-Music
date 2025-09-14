"""
AniList Manga COMPLETED Marker

Instructions:
1. Run this script: python anilist_manga_marker.py
2. Paste an AniList manga URL (e.g. https://anilist.co/manga/129725/New-Normal/)
3. The script will:
   - Extract the manga ID
   - Get chapter/volume info via API
   - If missing, scrape from AniList page
   - If still missing, ask you manually
   - Mark the manga as COMPLETED with full info
"""

import os
import json
import re
import requests

CONFIG_PATH = os.path.expanduser('~/.anilist_config.json')
API_URL = 'https://graphql.anilist.co'


def get_token():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r') as f:
                token = json.load(f).get('access_token')
                if token:
                    return token
        except Exception:
            pass
    print("🔐 No token found. Get one at: https://anilist.co/settings/developer")
    token = input("Paste your AniList access token: ").strip()
    with open(CONFIG_PATH, 'w') as f:
        json.dump({'access_token': token}, f)
    return token


def extract_manga_id(url):
    match = re.search(r'anilist.co/manga/(\d+)', url)
    return int(match.group(1)) if match else None


def fetch_manga_data(manga_id, token):
    query = '''
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        title { romaji english native }
        chapters
        volumes
      }
    }'''
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    variables = {'id': manga_id}
    res = requests.post(API_URL, json={'query': query, 'variables': variables}, headers=headers)
    data = res.json()
    media = data.get('data', {}).get('Media', {})
    title = media.get('title', {}).get('romaji') or 'Unknown Title'
    return media.get('chapters'), media.get('volumes'), title


def scrape_chapter_volume(manga_id):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("⚠️ Install Playwright: pip install playwright && playwright install")
        return None, None
    url = f'https://anilist.co/manga/{manga_id}/'
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, timeout=15000)
        page.wait_for_selector('script#__NEXT_DATA__', timeout=10000)
        script = page.query_selector('script#__NEXT_DATA__')
        if not script:
            return None, None
        try:
            json_data = json.loads(script.inner_text())
            media = json_data['props']['pageProps']['dehydratedState']['queries'][0]['state']['data']['Media']
            return media.get('chapters'), media.get('volumes')
        except Exception:
            return None, None
        finally:
            browser.close()


def prompt_missing(title, chapters, volumes):
    if not chapters:
        chapters = int(input(f"Enter chapter count for '{title}': "))
    if not volumes:
        volumes = int(input(f"Enter volume count for '{title}': "))
    return chapters, volumes


def mark_completed(manga_id, token, chapters, volumes, title):
    mutation = '''
    mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $progressVolumes: Int) {
      SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, progressVolumes: $progressVolumes) {
        id status
      }
    }'''
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    variables = {
        'mediaId': manga_id,
        'status': 'COMPLETED',
        'progress': chapters,
        'progressVolumes': volumes
    }
    res = requests.post(API_URL, json={'query': mutation, 'variables': variables}, headers=headers)
    if 'errors' in res.json():
        print("❌ Failed:", res.json()['errors'][0]['message'])
    else:
        print(f"✅ '{title}' marked as COMPLETED ({chapters} chapters, {volumes} volumes)")


def main():
    print("📘 Paste an AniList manga URL to mark it as COMPLETED.")
    url = input("URL: ").strip()
    manga_id = extract_manga_id(url)
    if not manga_id:
        print("❌ Invalid URL.")
        return

    token = get_token()
    chapters, volumes, title = fetch_manga_data(manga_id, token)
    if not chapters or not volumes:
        print("🔍 API missing data, trying to scrape...")
        scraped_chapters, scraped_volumes = scrape_chapter_volume(manga_id)
        chapters = chapters or scraped_chapters
        volumes = volumes or scraped_volumes
    if not chapters or not volumes:
        print("✏️ Still incomplete. Asking manually...")
        chapters, volumes = prompt_missing(title, chapters, volumes)
    mark_completed(manga_id, token, chapters, volumes, title)


if __name__ == '__main__':
    main()
