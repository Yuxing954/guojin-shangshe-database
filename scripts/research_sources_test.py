import unittest
import json
import tempfile
from pathlib import Path
from research_sources import merge_rows, archive_rows


class ResearchMergeTests(unittest.TestCase):
    def test_keep_archive_and_prefer_full_update(self):
        old={'时间':'2026-09-12T00:00:00','标题':'旧内容','内容':'截断…','原文链接':'https://wx.zsxq.com/group/1/topic/2'}
        new={**old,'内容':'完整正文'}
        history={'时间':'2025-01-01','标题':'历史','内容':'历史正文'}
        merged=merge_rows([old,history],[new,new])
        self.assertEqual(len(merged),2)
        self.assertEqual(merged[0]['内容'],'完整正文')
        self.assertIn(history,merged)
    def test_multiple_attachments_and_timestamp_order(self):
        common={'日期':'2026-10-07','下载链接':'https://wx.zsxq.com/group/1/topic/3'}
        a={**common,'标题':'A','文件名':'A.pdf','摘要':'附件 A'}
        b={**common,'标题':'B','文件名':'B.docx','摘要':'附件 B'}
        self.assertEqual(len(merge_rows([], [a,b,a])),2)
        self.assertEqual(merge_rows([], [{'时间':'2026-10-07T09:00:00','标题':'早','内容':'1'},{'时间':'2026-10-07T16:00:00','标题':'晚','内容':'2'}])[0]['标题'],'晚')

    def test_reassigned_topic_keeps_original_archive_intact(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as tmp:
            path=Path(tmp)/'data/research/updates/manifest.json'
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps({'assignedTopics':{'all_views':['3']}}),encoding='utf-8')
            base=[{'原文链接':'https://wx.zsxq.com/group/1/topic/3','标题':'半导体提到零售'}, {'原文链接':'https://wx.zsxq.com/group/1/topic/4','标题':'酒店'}]
            self.assertEqual(len(archive_rows(tmp,'views',base)),1)
            self.assertEqual(len(base),2)


if __name__=='__main__': unittest.main()
