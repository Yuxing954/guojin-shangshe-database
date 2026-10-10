import copy
from datetime import date, datetime, timezone
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'update'))
import macro_data as m
import polymarket_data as p

class MacroTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=json.loads((ROOT/'data/macro/catalog.json').read_text(encoding='utf-8'))
    def test_failure_retains_last_success_and_dates(self):
        previous=dict(status='ready',fetchedAt='2025-01-01',observations=[m.observation('2024',1)])
        result=m.apply_result(previous,None,'2026-10-09',error=True)
        self.assertEqual(result['status'],'error');self.assertEqual(result['observations'],previous['observations'])
        self.assertEqual(result['fetchedAt'],'2025-01-01')
        result=m.apply_result(previous,dict(observations=[]),'2026-10-09')
        self.assertEqual(result['status'],'empty');self.assertEqual(result['observations'],previous['observations'])
    def test_worldbank_identity_and_future_filter(self):
        spec=next(s for s in self.catalog['series'] if s['id']=='cn-gdp')
        body=[dict(pages=1,lastupdated='2026-10-08'),[
          dict(indicator=dict(id=spec['code']),countryiso3code='CHN',date='2025',value=3),
          dict(indicator=dict(id=spec['code']),countryiso3code='CHN',date='2026',value=4)]]
        with patch.object(m,'fetch',return_value=(body,'digest')):
            result=m.worldbank(spec,date(2026,10,9))
        self.assertEqual([r['period'] for r in result['observations']],['2025'])
        self.assertIsNone(result['observations'][0]['releaseDate'])
        body[1][0]['countryiso3code']='USA'
        with patch.object(m,'fetch',return_value=(body,'digest')),self.assertRaises(ValueError):m.worldbank(spec,date(2026,10,9))
    def test_bls_null_and_annual_average_are_not_months(self):
        spec=next(s for s in self.catalog['series'] if s['id']=='us-unemployment')
        body=dict(status='REQUEST_SUCCEEDED',Results=dict(series=[dict(seriesID=spec['code'],data=[
          dict(year='2025',period='M13',value='4.1'),dict(year='2025',period='M10',value='-'),
          dict(year='2026',period='M09',value='4.2',footnotes=[dict(text='Revised')])])]))
        with patch.object(m,'fetch',return_value=(body,'digest')):
            result=m.bls_batch([spec],date(2026,10,9))[spec['id']]
        self.assertEqual(len(result['observations']),1)
        self.assertEqual(result['observations'][0]['footnotes'],['Revised'])
    def test_manual_import_requires_review_dates_units_and_original_domain(self):
        entry=dict(id='cn-cpi',unit='%',adjustment='同比',reviewedBy='Research reviewer',
          redistributionApproved=True,licenseBasis='Reviewed source permission',observations=[
          dict(period='2026-08',value=.1,releaseDate='2026-09-09',sourceUrl='https://www.stats.gov.cn/example')])
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'rows.json'
            def run(value):
                path.write_text(json.dumps(dict(series=[value])),encoding='utf-8')
                return m.reviewed_import(path,self.catalog,date(2026,10,9))
            self.assertEqual(run(entry)['cn-cpi']['observations'][0]['value'],.1)
            for field,value in [('unit','亿元'),('redistributionApproved',False),('reviewedBy','')]:
                invalid=copy.deepcopy(entry);invalid[field]=value
                with self.assertRaises(ValueError):run(invalid)
            for field,value in [('releaseDate','2026-10-10'),('sourceUrl','https://stats.gov.cn.evil.test/')]:
                invalid=copy.deepcopy(entry);invalid['observations'][0][field]=value
                with self.assertRaises(ValueError):run(invalid)
    def test_real_snapshot_has_valid_traceable_observations(self):
        snapshot=json.loads((ROOT/'data/macro/snapshot.json').read_text(encoding='utf-8'))
        specs={s['id']:s for s in self.catalog['series']}
        self.assertEqual(set(snapshot['series']),set(specs))
        for key,data in snapshot['series'].items():
            seen=set();spec=specs[key]
            for row in data.get('observations',[]):
                m.validate_period(row['period'],spec['frequency'])
                self.assertNotIn(row['period'],seen);seen.add(row['period'])
                self.assertLessEqual(m.period_end(row['period'],spec['frequency']),date.fromisoformat(snapshot['cutoff']))
                m.observation(row['period'],row['value'])
            if data.get('observations'):
                self.assertTrue(data.get('sourceUrl','').startswith('https://'))
                self.assertEqual(len(data.get('receiptSha256','')),64)
    def test_polymarket_excludes_irrelevant_expired_and_invalid_probabilities(self):
        now=datetime(2026,10,9,tzinfo=timezone.utc)
        market=dict(id=1,question='Will the Fed cut interest rates?',active=True,closed=False,
          endDate='2026-12-01T00:00:00Z',outcomes='["Yes","No"]',outcomePrices='["0.4","0.6"]',
          events=[dict(id=1,slug='fed-rate')],volume24hr=100,liquidityNum=500,spread=.01)
        self.assertEqual(p.normalize(market,now)['outcomes'][0]['probability'],.4)
        for field,value in [('question','Will Lakers win the NBA?'),('endDate','2026-01-01T00:00:00Z'),
                            ('outcomePrices','["1.1","0"]'),('closed',True)]:
            self.assertIsNone(p.normalize({**market,field:value},now))
        selected=p.select([{**p.normalize(market,now),'id':str(i)} for i in range(10)])
        self.assertEqual(len(selected),3)
    def test_real_prediction_snapshot(self):
        snapshot=json.loads((ROOT/'data/macro/predictions.json').read_text(encoding='utf-8'))
        self.assertGreater(len(snapshot['markets']),0)
        events={}
        for market in snapshot['markets']:events.setdefault(market['eventId'],[]).append(market)
        for items in events.values():
            self.assertEqual(len(items),items[0]['eventActiveMarketCount'])
            self.assertTrue(all(m['eventComplete'] for m in items))
        for category in {m['category'] for m in snapshot['markets']}:
            self.assertLessEqual(sum(items[0]['category']==category for items in events.values()),6)
        self.assertEqual(len({m['id'] for m in snapshot['markets']}),len(snapshot['markets']))
        for market in snapshot['markets']:
            self.assertTrue(market['url'].startswith('https://polymarket.com/event/'))
            self.assertLess(abs(sum(o['probability'] for o in market['outcomes'])-1),.05)
    def test_complete_event_rejects_partial_invalid_outcomes(self):
        now=datetime(2026,10,10,tzinfo=timezone.utc)
        row=dict(id='1',question='Will the Fed cut interest rates?',active=True,closed=False,
            endDate='2026-12-01T00:00:00Z',outcomes=['Yes','No'],outcomePrices=['.4','.6'])
        seed=dict(eventId='10',category='经济与利率')
        event=dict(id=10,slug='fed-rate',title='Fed Decision in December?',markets=[row,{**row,'id':'2'}])
        self.assertEqual(len(p.expand_event(event,seed,now)),2)
        event['markets'][1]['outcomePrices']=['1.1','-.1']
        with self.assertRaises(ValueError):p.expand_event(event,seed,now)
    def test_prior_probability_requires_same_contract_and_question(self):
        old=dict(markets=[dict(id='1',question='original',outcomes=[dict(name='Yes',probability=.3)])])
        new=[dict(id='1',question='changed',outcomes=[dict(name='Yes',probability=.5)])]
        self.assertNotIn('previousProbability',p.with_previous(new,old)[0]['outcomes'][0])
        new[0]['question']='original'
        self.assertEqual(p.with_previous(new,old)[0]['outcomes'][0]['previousProbability'],.3)
    def test_failed_event_refresh_retains_last_snapshot(self):
        prior=dict(version=2,status='ready',fetchedAt='2026-10-09T00:00:00Z',markets=[dict(id='existing')])
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'predictions.json';target.write_text(json.dumps(prior),encoding='utf-8')
            with patch.object(p,'TARGET',target),patch.object(p,'fetch',side_effect=ValueError('upstream unavailable')):
                with self.assertRaises(SystemExit):p.main()
            result=json.loads(target.read_text(encoding='utf-8'))
            self.assertEqual(result['markets'],prior['markets']);self.assertEqual(result['fetchedAt'],prior['fetchedAt'])
            self.assertEqual(result['status'],'error')

if __name__=='__main__':unittest.main()


