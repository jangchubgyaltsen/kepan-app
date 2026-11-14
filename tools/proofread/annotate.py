"""把校对结果写成 Word 批注：另存一份科判副本，原稿不动。
用法: python annotate.py 科判.docx [--jj 讲记.docx|pdf] [--ft 繁体科判.docx] [-o 输出.docx]
"""
import sys, os, re, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from kpcheck import run_check, walk, norm_text, read_cells, wtext, table_titles

AUTHOR = '科判校对'
LEVEL_WORD = {'高': '请确认', '中': '请看一下', '低': '仅供参考'}


def _runs_of(doc, el):
    """el（单元格或段落）里第一个有字的段落的所有 run；没有 run 就补一个空 run"""
    ps = [el] if el.tag == qn('w:p') else list(el.iter(qn('w:p')))
    for p in ps:
        para = Paragraph(p, doc._body)
        rs = [r for r in para.runs if r.text.strip()]
        if rs:
            return rs
    para = Paragraph(ps[0], doc._body) if ps else None
    if para is None:
        return None
    return [para.add_run('')]


class Anchors:
    """根据问题里提到的科判名称或经文上下文，找到要挂批注的格子"""

    def __init__(self, doc, root):
        self.doc = doc
        self.nodes = [n for n, _ in walk(root) if getattr(n, 'tc', None) is not None]
        self.tables = list(doc.tables)
        tt = table_titles(doc)
        self.tname = {k: ('表' + t['id']) if t else f'第{k+1}个表格' for k, t in enumerate(tt)}
        self.cells = []   # (表序号, 格子dict)
        for k, t in enumerate(self.tables):
            for c in read_cells(t._tbl):
                if c['text']:
                    self.cells.append((k, c, norm_text(c['text'])))

    def by_label(self, text):
        qs = re.findall(r'「([^」]{2,})」', text)
        for q in qs:
            q = re.sub(r'[〔〕　\s]', '', q)
            for n in self.nodes:
                if n.raw == q or n.name == q or (len(q) >= 6 and n.raw.startswith(q)):
                    return n.tc
            for n in self.nodes:
                if len(q) >= 3 and q in n.raw:
                    return n.tc
        return None

    def by_context(self, msg):
        m = re.search(r'…([^…〔]*)〔([^〕]*)〕([^…]*)…', msg)
        if not m:
            return None
        a, x, b = (norm_text(s.replace('　', '')) for s in m.groups())
        for want in (a + x + b, a + x, x + b, a):
            if len(want) >= 4:
                for k, c, nt in self.cells:
                    if want in nt:
                        return c['tc']
        return None

    def by_cover(self, msg):
        m = re.search(r'正文有「([^」…]+)', msg)
        if not m:
            return None
        want = norm_text(m.group(1))[:10]
        for k, c, nt in self.cells:
            if len(want) >= 4 and want in nt:
                return c['tc']
        return None

    def by_title(self, where):
        m = re.match(r'表([0-9a-zA-Z]+(?:-\d+)?)', where)
        if not m:
            return None
        for p in self.doc.element.body.iterchildren(qn('w:p')):
            t = wtext(p).strip()
            if re.match(rf'表?\s*{re.escape(m.group(1))}\s*[：:]', t):
                return p
        return None

    def by_cell_text(self, msg, where):
        m = re.search(r'不像科判（没有编号）：(.+)$', msg)
        if not m:
            return None
        want = norm_text(m.group(1))[:12]
        tn = where.split('：')[0]
        hits = [(k, c) for k, c, nt in self.cells if want and nt.startswith(want)]
        for k, c in hits:
            if self.tname.get(k) == tn:
                return c['tc']
        if hits:
            return hits[0][1]['tc']
        return None

    def find(self, issue):
        if issue['kind'] == '表格标题':
            el = self.by_title(issue['where'])
            if el is not None:
                return el
        if issue['kind'] == '版面':
            el = self.by_cell_text(issue['msg'], issue['where'])
            if el is not None:
                return el
        if issue['kind'] in ('经文用字', '经文异体字', '讲记前后不一'):
            el = self.by_context(issue['msg'])
            if el is not None:
                return el
        if issue['kind'] in ('经文覆盖', '讲记不全'):
            el = self.by_cover(issue['msg'])
            if el is not None:
                return el
        el = self.by_label(issue['msg'])
        return el if el is not None else self.by_label(issue['where'])


def comment_text(i):
    return f"【{LEVEL_WORD[i['level']]}·{i['kind']}】{i['where']}：{i['msg']}"


def annotate(kpath, jpath=None, ftpath=None, out=None, log=print, out_dir=None):
    log('读取科判……')
    r = run_check(kpath, jpath)
    doc = r['doc']
    anc = Anchors(doc, r['root'])
    fj = []
    if ftpath:
        log('对照繁体版……')
        from fjcheck import compare
        fj = compare(doc, ftpath)
    placed, unplaced = 0, []
    log('写批注……')
    for i in r['main']:
        el = anc.find(i)
        runs = _runs_of(doc, el) if el is not None else None
        if runs:
            doc.add_comment(runs, text=comment_text(i), author=AUTHOR, initials='校')
            placed += 1
        else:
            unplaced.append(i)
    for lv, kind, msg, pos in fj:
        el = None
        if pos:
            k, r0, c0 = pos
            for c in read_cells(anc.tables[k]._tbl):
                if c['r0'] == r0 and c['c0'] == c0:
                    el = c['tc']
        runs = _runs_of(doc, el) if el is not None else None
        item = dict(level=lv, kind=kind, where='繁简对照', msg=msg)
        if runs:
            doc.add_comment(runs, text=comment_text(item), author=AUTHOR, initials='校')
            placed += 1
        else:
            unplaced.append(item)
    # 文档开头一条总批注：统计、没能挂到格子上的问题、讲记本身的提醒
    lines = [f"科判校对（规则比对，不用 AI）{datetime.date.today():%Y-%m-%d}",
             f"共 {placed + len(unplaced)} 条：请确认 {sum(1 for i in r['main'] if i['level'] == '高')}，"
             f"请看一下 {sum(1 for i in r['main'] if i['level'] == '中')}，仅供参考 {sum(1 for i in r['main'] if i['level'] == '低')}"
             + (f"；繁简对照 {len(fj)}" if ftpath else '')]
    if jpath:
        lines.append('对照的讲记：' + os.path.basename(jpath))
    if unplaced:
        lines.append('')
        lines.append('以下几条找不到对应的格子，列在这里：')
        lines += ['· ' + comment_text(i) for i in unplaced]
    if r['remind']:
        lines.append('')
        lines.append(f"提醒：讲记本身另有 {len(r['remind'])} 处可能要看（不是科判的问题，没有标在科判上）：")
        lines += [f"· {i['where']}：{i['msg']}" for i in r['remind']]
    first = next((p for p in doc.paragraphs if p.text.strip()), doc.paragraphs[0])
    runs = [x for x in first.runs if x.text.strip()] or [first.add_run('')]
    doc.add_comment(runs, text='\n'.join(lines), author=AUTHOR, initials='校')
    if not out:
        base, ext = os.path.splitext(kpath)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
            base = os.path.join(out_dir, os.path.basename(base))
        out = f'{base} 校对{datetime.datetime.now():%m%d%H%M}.docx'
    doc.save(out)
    log(f'完成：{placed + 1} 条批注，已另存为 {os.path.basename(out)}')
    return out, r, fj


def main():
    a = sys.argv[1:]
    get = lambda f: a[a.index(f) + 1] if f in a else None
    annotate(a[0], get('--jj'), get('--ft'), get('-o'))


if __name__ == '__main__':
    main()
