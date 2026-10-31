"""Logs browser smoke for Ontario: code search lists Ontario codes and the licensor legend shows beside them.
Synthetic passcode/data only. Run: python3 tests/ontario_ui.py  (needs playwright + Chrome; set CHROME to override)"""
import http.server, threading, functools, os, sys
from playwright.sync_api import sync_playwright
LEG = "© King's Printer for Ontario, 2026. Reproduced with permission."
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=os.path.join(os.path.dirname(__file__), '..', 'site')))
threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = []
def check(n, c):
    print(('PASS ' if c else 'FAIL ') + n)
    if not c: fails.append(n)
PIN = '48203917'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1400, 'height': 900}, service_workers='block').new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{srv.server_port}/'); pg.wait_for_selector('#sPass')
    pg.check('input[name=sKind][value=pin]'); pg.fill('#sPass', PIN); pg.fill('#sPass2', PIN); pg.check('#sAck'); pg.check('#sResp'); pg.click('#sBtn')
    pg.wait_for_function("()=>!document.body.classList.contains('locked')"); pg.wait_for_timeout(400)
    pg.evaluate("""async()=>{const s=Date.now()-3600e3;await window.Vault.save({id:'t1',kind:'enc',name:'Patient 1',mrn:'',chart:'',label:'',initials:'',billingNote:'',setting:'H',facility:null,type:'',codes:[],notes:[],segs:[{s,e:s+20*60e3}],status:'done',photos:[],links:[],created:s,updated:s});}""")
    pg.click('#lockNow'); pg.wait_for_selector('#unlockForm:not([hidden])'); pg.fill('#uPass', PIN); pg.click('#uBtn')
    pg.wait_for_function("()=>!document.body.classList.contains('locked')"); pg.wait_for_timeout(600)
    pg.click('#tabs [data-tab="today"]'); pg.wait_for_timeout(500)
    pg.locator('#todayList tbody .rn').first.dblclick(); pg.wait_for_timeout(600); pg.get_by_role('button', name='Edit', exact=False).filter(has_text='Edit').first.click(); pg.wait_for_selector('#eProv', state='visible', timeout=8000)
    check('Ontario selectable (not held)', pg.evaluate("[...document.querySelectorAll('#eProv option')].some(o=>o.value==='ON'&&!/pending/.test(o.textContent))"))
    pg.select_option('#eProv', 'ON'); pg.wait_for_timeout(800)
    cred = pg.inner_text('#eCredit'); check('credit shows legend for both works + disclaimer', cred.count(LEG) == 2 and 'no representation about the accuracy' in cred)
    pg.fill('#eCodeQ', 'A001'); pg.wait_for_timeout(1000)
    res = pg.inner_text('#eCodeRes'); check('A001 listed with fee', 'A001' in res and '26.80' in res)
    check('no page errors', not errs)
    b.close()
sys.exit(1 if fails else 0)
