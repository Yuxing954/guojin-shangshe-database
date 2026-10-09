import sys,unittest,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'update'))
from gold_research import nbs_row,cga_row
class DemandGuards(unittest.TestCase):
    def nbs(self,values='247</td><td>-17.5</td><td>2362</td><td>-1.5'):
        return '<h1>2026年8月份社会消费品零售总额主要数据</h1>绝对量（亿元）<table><tr><td>金银珠宝类</td><td>'+values+'</td></tr></table>'
    def test_nbs_duplicate_mobile_table_and_conflict(self):
        h=self.nbs();r=nbs_row(h+h,'2026-08');self.assertEqual(r['amount'],247);self.assertEqual(r['ytdAmount'],2362)
        with self.assertRaises(ValueError):nbs_row(h+self.nbs('999</td><td>-17.5</td><td>2362</td><td>-1.5'),'2026-08')
    def test_period_and_jan_feb(self):
        with self.assertRaises(ValueError):nbs_row(self.nbs(),'2026-07')
        with self.assertRaises(ValueError):nbs_row(self.nbs(),'2026-01')
        h='<h1>2026年1—2月份社会消费品零售总额主要数据</h1>绝对量（亿元）<table><tr><td>金银珠宝类</td><td>500</td><td>13.0</td></tr></table>'
        r=nbs_row(h,'2026-02');self.assertEqual(r['basis'],'jan_feb');self.assertEqual(r['periodStart'],'2026-01-01');self.assertEqual(r['amount'],r['ytdAmount'])
    def test_consumption_is_national_and_correct_cumulative_period(self):
        h='2026年上半年，我国黄金消费量511.412吨，同比增长1.23%。其中：黄金首饰132.133吨，同比下降33.88%；金条及金币339.336吨，同比增长28.42%；工业及其他用金39.943吨，同比下降2.90%。'
        r=cga_row(h,'2026-Q2');self.assertEqual(r['basis'],'cumulative');self.assertEqual(r['values']['jewelry'],132.133);self.assertEqual(r['yoy']['bars'],28.42)
        for wrong in ('2026-Q1','2026-Q3','2026-Q4','2025-Q2'):
            with self.assertRaises(ValueError):cga_row(h,wrong)
        with self.assertRaises(ValueError):cga_row(h.replace('我国','吉林省'),'2026-Q2')
if __name__=='__main__':unittest.main()
