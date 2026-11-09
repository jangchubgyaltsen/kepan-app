"""造一份带错的小科判，跑一遍校对，确认批注写进去了（打包前自检用）。"""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docx
from annotate import annotate

d = docx.Document()
d.add_paragraph('测试 科判')
d.add_paragraph('表1：（1表） 测试')
t = d.add_table(rows=3, cols=3)
a = t.cell(0, 0).merge(t.cell(2, 0)); a.text = '全文分三'
t.cell(0, 1).text = '一、初'; t.cell(0, 2).text = '如是我闻'
t.cell(1, 1).text = '二、中'; t.cell(1, 2).text = '一时佛在'
t.cell(2, 1).text = '四、后'; t.cell(2, 2).text = '皆大欢喜'
tmp = tempfile.mkdtemp()
src = os.path.join(tmp, 'k.docx'); d.save(src)
out, r, _ = annotate(src, out=os.path.join(tmp, 'k 校对.docx'), log=lambda *_: None)
notes = [c.text for c in docx.Document(out).comments]
assert any('序号' in n for n in notes), notes
print('selfcheck ok,', len(notes), 'comments')
