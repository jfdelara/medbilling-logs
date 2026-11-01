"""Unit tests for scripts/rebuild-from-feedesk.py and scripts/ci/cf-bundle.py. No network, no browser.
Run: python3 -m unittest discover -s tests -p 'test_*.py' -v"""
import importlib.util, json, os, shutil, tempfile, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, rel)); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
rb = load('rebuild', 'scripts/rebuild-from-feedesk.py')
cf = load('cfb', 'scripts/ci/cf-bundle.py')

def write(p, t):
    os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(t)

class BumpSw(unittest.TestCase):
    def sw(self, v):
        d = tempfile.mkdtemp(); p = os.path.join(d, 'sw.js'); write(p, f"// c\nconst V = '{v}';\nconst A = [];\n"); return p
    def test_new_date_starts_at_data1(self):
        p = self.sw('bl-v13-20261101-url-switch-h-no-surname')
        old, new = rb.bump_sw('20261102', p)
        self.assertEqual(old, 'bl-v13-20261101-url-switch-h-no-surname'); self.assertEqual(new, 'bl-v13-20261102-url-switch-h-no-surname-data1')
    def test_same_date_increments(self):
        p = self.sw('bl-v13-20261102-url-switch-h-data1')
        self.assertEqual(rb.bump_sw('20261102', p)[1], 'bl-v13-20261102-url-switch-h-data2')
    def test_next_date_resets(self):
        p = self.sw('bl-v13-20261102-url-switch-h-data7')
        self.assertEqual(rb.bump_sw('20261109', p)[1], 'bl-v13-20261109-url-switch-h-data1')
    def test_url_switch_token_survives(self):
        p = self.sw('bl-v13-20261101-url-switch-h-no-surname'); rb.bump_sw('20261102', p)
        self.assertIn('url-switch', open(p).read())
    def test_unknown_format_fails(self):
        with self.assertRaises(SystemExit): rb.bump_sw('20261102', self.sw('something-else'))
    def test_repo_sw_matches(self):
        self.assertTrue(rb.V_RE.search(open(rb.SW, encoding='utf-8').read()))

class MirrorAndSnapshot(unittest.TestCase):
    def test_mirror_makes_identical_and_keeps_nojekyll(self):
        d = tempfile.mkdtemp(); a, b = os.path.join(d, 'public'), os.path.join(d, 'site')
        write(os.path.join(a, 'x.js'), '1'); write(os.path.join(a, 'data', 'c.json'), '[1]'); write(os.path.join(b, 'x.js'), 'old'); write(os.path.join(b, 'gone.js'), 'z'); write(os.path.join(b, '.nojekyll'), '')
        self.assertTrue(rb.identical(a, b))
        rb.mirror(a, b)
        self.assertEqual(rb.identical(a, b), []); self.assertTrue(os.path.exists(os.path.join(b, '.nojekyll'))); self.assertFalse(os.path.exists(os.path.join(b, 'gone.js')))
    def test_snapshot_detects_change(self):
        d = tempfile.mkdtemp(); write(os.path.join(d, 'a.json'), '1'); s1 = rb.snapshot(d); write(os.path.join(d, 'a.json'), '2'); self.assertNotEqual(s1, rb.snapshot(d))
    def test_repo_public_and_site_are_identical(self):
        self.assertEqual(rb.identical(), [])

class FeeDeskDir(unittest.TestCase):
    def mk(self, sub, files):
        d = tempfile.mkdtemp()
        for f in files: write(os.path.join(d, sub, f), '{}')
        return d
    FULL = ('codes.json', 'meta.json', 'icd9.json', 'prov/index.json')
    def test_site_data(self): d = self.mk('site/data', self.FULL); self.assertTrue(rb.fd_data_dir(d).endswith('site/data'))
    def test_public_data_fallback(self): d = self.mk('public/data', self.FULL); self.assertTrue(rb.fd_data_dir(d).endswith('public/data'))
    def test_missing_file_fails(self):
        d = self.mk('site/data', self.FULL[:-1])
        with self.assertRaises(SystemExit): rb.fd_data_dir(d)
    def test_no_folder_fails(self):
        with self.assertRaises(SystemExit): rb.fd_data_dir(tempfile.mkdtemp())

class CfBundle(unittest.TestCase):
    def test_both_patches_apply_to_repo_sw(self):
        out = cf.patch_sw(open(os.path.join(ROOT, 'public', 'sw.js'), encoding='utf-8').read())
        self.assertIn('r.redirected ? new Response(await r.blob()', out); self.assertIn('if (res.redirected) res = new Response(await res.blob()', out)
    def test_fails_when_pattern_missing(self):
        with self.assertRaises(SystemExit): cf.patch_sw('no patterns here')
    def test_build_copies_public_and_leaves_source(self):
        d = tempfile.mkdtemp(); out = cf.build(os.path.join(ROOT, 'public'), os.path.join(d, 'o'))
        self.assertTrue(os.path.exists(os.path.join(out, 'index.html'))); self.assertNotIn('redirected', open(os.path.join(ROOT, 'public', 'sw.js')).read())

class HeldJurisdictions(unittest.TestCase):
    def test_committed_logs_index_publishes_no_held_jurisdiction_data(self):
        idx = json.load(open(os.path.join(ROOT, 'public', 'data', 'codes-index.json')))
        by = {e['id']: e for e in idx['list']}
        self.assertFalse(set(by) & {'BC', 'ON', 'QC', 'PE', 'NB'}, set(by))
        if 'NS' in by: self.assertEqual(by['NS']['n'], 0)       # Nova Scotia is listed as "soon" with no codes
        for h in ('BC', 'ON', 'QC', 'PE', 'NB', 'NS'):
            self.assertFalse(os.path.exists(os.path.join(ROOT, 'public', 'data', f'codes-{h}.json')), h)

if __name__ == '__main__': unittest.main()
