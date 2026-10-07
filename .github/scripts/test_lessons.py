"""Guard research denominators, historical measures and complete citation coverage."""
import json,re,subprocess,sys,unittest
from pathlib import Path
from check_site import ROOT,PUBLIC_FILES
class LessonEvidenceTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.data=json.loads((ROOT/'lessons-data.json').read_text())
 def test_source_and_claim_register_are_complete(self):
  d=self.data;sources={s['id']:s for s in d['sources']};claims={q['id']:q for q in d['claims']}
  self.assertEqual(len(sources),45);self.assertEqual(len(claims),49)
  for q in claims.values():
   self.assertTrue(q['locator']);self.assertTrue(q['kind']);self.assertTrue(q['sources'])
   for sid in q['sources']:self.assertIn(sid,sources)
  for source in sources.values():
   self.assertTrue(source['used_by'])
   for qid in source['used_by']:self.assertIn(qid,claims)
 def test_schools_and_grouped_episodes_are_not_mixed(self):
  c=self.data['catalogue'];f=self.data['comparisons'];schools=c['schools']
  self.assertEqual(len(schools),12);self.assertEqual(len(f['schools']),4)
  self.assertEqual(len({s['urn'] for s in schools+f['schools']}),16)
  self.assertEqual(len(c['reason_episodes']),9)
  self.assertEqual(sum(e['n_schools'] for e in c['reason_episodes']),12)
  self.assertEqual([sum(s['stage']==stage for s in schools) for stage in ['Initial consultation','Local decision after statutory notice','External intervention']],[3,3,6])
  self.assertNotIn('cowes',[s['id'] for s in schools]);self.assertEqual(sum(s['id']=='cowes' for s in f['schools']),1)
 def test_financial_forecasts_and_petition_denominators(self):
  c=self.data['catalogue']['fletching_budget'];f=self.data['comparisons']
  self.assertEqual(c['original'],[-5457,-62138,-145863]);self.assertEqual(c['revised_optimistic'],[40920,-3299,-39338]);self.assertEqual(c['revised_cautious'],[40920,-3299,-95588])
  self.assertEqual([c['cash_raised'],c['trust_pledge'],c['parish_resolution']],[44368,20000,10000])
  self.assertEqual(sum(r['online'] for r in f['petition_snapshot']['schools']),3771)
  self.assertEqual({r['id']:r['paper'] for r in f['petition_snapshot']['schools'] if r['paper'] is not None},{'brading':102,'godshill':542,'arreton':250})
  self.assertEqual(f['hackney_consultation']['clear_proposal_responses'],219)
  self.assertEqual(f['hackney_consultation']['submissions'],175)
 def test_comparison_findings_link_to_paired_case_records(self):
  d=self.data;reprieves={s['id'] for s in d['catalogue']['schools']};closures={s['id'] for s in d['comparisons']['schools']}
  sources={s['id'] for s in d['sources']};lessons=d['comparisons']['comparison_lessons']
  self.assertEqual(len(lessons),3);self.assertEqual(len({p['id'] for p in lessons}),3)
  for lesson in lessons:
   self.assertTrue(lesson['record']);self.assertTrue(lesson['limit']);self.assertTrue(lesson['question'])
   linked={case_id for outcome in lesson['outcomes'] for case_id in outcome['case_ids']}
   self.assertTrue(linked & reprieves);self.assertTrue(linked & closures)
   self.assertLessEqual(linked,reprieves | closures)
   self.assertLessEqual(set(lesson['sources']),sources)
 def test_public_research_has_no_private_estimate_and_retains_limits(self):
  for name in ['lessons-data.json','lessons.html','lessons-sources.html']+[p.name for p in ROOT.glob('lessons-0*.svg')]:
   text=(ROOT/name).read_text();self.assertIsNone(re.search(r'10\s*[-–]\s*15\s*%',text),name)
  text=(ROOT/'lessons.html').read_text()
  for term in ['not a matched control group','pupil scenario','not a confidence interval','academy successor','renewed proposal','not measured effectiveness','extra term']:
   self.assertIn(term,text)
 def test_pages_are_fresh_and_assets_are_vector_and_high_resolution(self):
  subprocess.run([sys.executable,str(ROOT/'.github/scripts/build_lessons.py'),'--check'],check=True,capture_output=True)
  self.assertEqual(len(self.data['exhibits']),8)
  for e in self.data['exhibits']:
   name='lessons-'+e['file']
   self.assertIn(name+'.svg',PUBLIC_FILES);self.assertIn(name+'.png',PUBLIC_FILES)
   self.assertIn('<title id="title">',(ROOT/(name+'.svg')).read_text())
   png=(ROOT/(name+'.png')).read_bytes()
   self.assertEqual(png[:8],b'\x89PNG\r\n\x1a\n');self.assertEqual(int.from_bytes(png[16:20],'big'),4800);self.assertEqual(int.from_bytes(png[20:24],'big'),3000)
  self.assertTrue((ROOT/'lessons-report.pdf').read_bytes().startswith(b'%PDF'))
if __name__=='__main__':unittest.main()
