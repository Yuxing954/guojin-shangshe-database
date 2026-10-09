"""Tests use real seed metadata and explicitly synthetic parser fixtures only."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('gold_jewelry',ROOT/'update/gold_jewelry.py')
g=importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

class GoldTests(unittest.TestCase):
    def setUp(self): self.data=g.read_json(ROOT/'data/gold-jewelry/observations.json')
    def test_real_seed(self):
        self.assertEqual(g.validate(self.data),[])
        self.assertEqual(len(self.data['brands']),10)
        self.assertEqual(len([q for q in self.data['quotes'] if q['id'].endswith('-20261008-jinjia')]),10)
    def test_bad_dates_and_prices(self):
        self.assertFalse(g.is_date('2026-02-30'))
        for value in (None,True,float('nan'),float('inf'),0,-1):
            d=copy.deepcopy(self.data); d['quotes'][0]['price']=value
            self.assertTrue(g.validate(d))
    def test_missing_brand_or_source(self):
        for field in ('brandId','sourceId'):
            d=copy.deepcopy(self.data); del d['quotes'][0][field]
            self.assertTrue(g.validate(d))
    def test_no_aggregator_upgrade(self):
        self.data['quotes'][0]['verification']='verified_primary'
        self.assertTrue(g.validate(self.data))
    def test_idempotent(self):
        merged=g.merge_batch(self.data,{'quotes':[self.data['quotes'][0]]})
        self.assertEqual(merged,self.data)
    def test_conflict_leaves_input_unchanged(self):
        original=copy.deepcopy(self.data)
        row={**self.data['quotes'][0],'price':1}
        with self.assertRaises(ValueError): g.merge_batch(self.data,{'quotes':[row]})
        self.assertEqual(self.data,original)
    def test_duplicate_logical_key(self):
        row={**self.data['quotes'][0],'id':'other-id'}
        with self.assertRaises(ValueError): g.merge_batch(self.data,{'quotes':[row]})
    def test_strict_json_and_atomic_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'data.json'; g.atomic_json(p,self.data)
            self.assertEqual(g.read_json(p),self.data)
            with self.assertRaises(ValueError): g.atomic_json(p,{'value':float('nan')})
            self.assertEqual(g.read_json(p),self.data)
            p.write_text('{"value": NaN}')
            with self.assertRaises(ValueError): g.read_json(p)
    def test_private_raw_archive(self):
        with self.assertRaises(ValueError): g.archive(b'test-fixture',{},ROOT/'raw-test')
        with tempfile.TemporaryDirectory() as tmp:
            p=g.archive(b'test-fixture',{'source':'unit-test-only'},Path(tmp))
            self.assertTrue(p.exists()); self.assertEqual(p.read_bytes(),b'test-fixture')
    def test_sge_parser_synthetic_fixture(self):
        # Synthetic HTML: not an archived report/page and never published as data.
        html='<table><tr><th>日期</th><th>合约</th><th>收盘价</th></tr><tr><td>2026-01-06</td><td>Au99.99</td><td>1,000.25</td></tr></table>'
        self.assertEqual(g.parse_sge(html,'2026-01-06'),1000.25)
        with self.assertRaises(ValueError): g.parse_sge(html,'2026-01-07')
        with self.assertRaises(ValueError): g.parse_sge('<p>loading</p>','2026-01-06')
        with self.assertRaises(ValueError): g.parse_sge(html+html,'2026-01-06')

if __name__=='__main__': unittest.main()
