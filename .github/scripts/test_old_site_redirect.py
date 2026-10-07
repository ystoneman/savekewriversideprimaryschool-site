"""Compatibility artifact boundaries: no full pages or active intake, exact downloads."""
from pathlib import Path
import tempfile
import unittest
from build_old_site_redirect import build, GENERATED, asset_files, POLICY
from check_site import ROOT, PUBLIC_FILES, stage_site

class LegacyArtifactTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
  self.source=Path(self.tmp.name)/'source'; stage_site(self.source)
  self.output=Path(self.tmp.name)/'output'
 def test_small_bundle_and_exact_downloads(self):
  count=build(self.source,self.output)
  expected=asset_files()|GENERATED|{f for f in PUBLIC_FILES if f.endswith('.html')}
  files={p.relative_to(self.output).as_posix() for p in self.output.rglob('*') if p.is_file()}
  self.assertEqual(files,expected); self.assertEqual(count,len(expected))
  self.assertNotIn('CNAME',files); self.assertNotIn('letters.js',files); self.assertNotIn('analytics.js',files)
  for f in asset_files()|{'visit/index.html'}:
   self.assertEqual((self.output/f).read_bytes(),(self.source/f).read_bytes(),f)
  for f in PUBLIC_FILES:
   self.assertEqual((self.source/f).read_bytes(),(ROOT/f).read_bytes(),f)
  for f in [v for v in PUBLIC_FILES if v.endswith('.html') and v!='visit/index.html']:
   text=(self.output/f).read_text()
   self.assertIn(POLICY,text); self.assertNotIn('<form',text); self.assertNotIn('formspree',text)
   self.assertNotIn('analytics.js',text); self.assertLess(len(text),4000)
   self.assertIn('Continue on the current website',text)
  self.assertIn('JavaScript is required', (self.output/'letters.html').read_text())
  self.assertIn('does not confirm that a submission arrived', (self.output/'sent.html').read_text())
 def test_extra_missing_symlink_and_existing_output_rejected(self):
  (self.source/'private.txt').write_text('fictional private data')
  with self.assertRaises(ValueError):build(self.source,self.output)
  self.assertFalse(self.output.exists());(self.source/'private.txt').unlink();(self.source/'index.html').unlink()
  with self.assertRaises(ValueError):build(self.source,self.output)
  (self.source/'index.html').symlink_to(ROOT/'index.html')
  with self.assertRaises(ValueError):build(self.source,self.output)
  self.output.mkdir();(self.output/'keep.txt').write_text('keep')
  with self.assertRaises(ValueError):build(self.source,self.output)
  self.assertEqual((self.output/'keep.txt').read_text(),'keep')
