"""Run: python tests/smoke_test.py
Requires playwright and installed Chromium. This test inlines assets because some
managed browser environments disallow opening local file/http URLs.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, shutil
ROOT=Path(__file__).resolve().parents[1]
page_html=(ROOT/'index.html').read_text(encoding='utf-8')
page_html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+ (ROOT/m.group(1)).read_text(encoding='utf-8')+'</style>',page_html)
page_html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>\n'+ (ROOT/m.group(1)).read_text(encoding='utf-8')+'\n</script>',page_html)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':800})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(page_html)
    page.locator('select[data-enemy=TOP]').wait_for()
    assert page.locator('select[data-enemy=TOP] option').count()==174
    page.locator('select[data-enemy=TOP]').select_option('Yone')
    page.locator('select[data-our=JUNGLE]').select_option('Lee Sin')
    page.locator('#seriesNext').click()
    assert page.locator('select[data-enemy=TOP] option[value="Yone"]').is_disabled()
    assert page.locator('select[data-our=JUNGLE] option[value="Lee Sin"]').is_disabled()
    assert not errors,errors
    print('PASS: app startup, full enemy roster, fearless lockouts, JS errors')
    browser.close()
