"""科判校对原型：不用 AI，纯规则比对。
用法: python kpcheck.py 科判.docx [讲记.docx]
"""
import sys, re, difflib, json
import docx
from docx.oxml.ns import qn

CN = '零一二三四五六七八九'
FW = str.maketrans('０１２３４５６７８９', '0123456789')
CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
VARIANTS = [set(x) for x in ['嗔瞋', '华花', '毘毗', '著着', '于於', '叹歎', '回迴', '惟唯', '修脩', '游遊', '阇闍', '硬鞕', '噉啗啖', '伏服']]


def cn2int(s):
    s = s.translate(FW)
    if s.isdigit():
        return int(s)
    if s == '初':
        return 1
    n = cur = 0
    for ch in s:
        if ch == '百':
            n += (cur or 1) * 100; cur = 0
        elif ch == '十':
            n += (cur or 1) * 10; cur = 0
        elif ch in CN:
            cur = CN.index(ch)
        else:
            return None
    return n + cur


NUM = '一二三四五六七八九十百'
STEMS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'
N = '[一二三四五六七八九十百]+'
D = '[0-9０-９]+'
LABEL_RE = re.compile(
    rf'^(?:(?P<f>[{STEMS}])(?P<fn>{N}|初)[、，]?|(?P<x>[{STEMS}])[、，]|(?P<u>[上中下])[ \u3000]+(?=\S)|第(?P<h>{N})(?P<hk>[品章课卷节目篇])\s*|第(?P<w>{N})、|(?P<a>{N})、|(?P<y>{N})者、|(?P<s>{N})[ \u3000]+(?=\S)|[（(](?P<b>{N})[）)]|(?P<c>{D})[、.．]|[（(](?P<d>{D})[）)]|(?P<g>{D})[）)]|(?P<e>[①-⑳]))')
TYPES = {'y': '一者、', 'w': '第一、', 'x': '甲、', 'u': '上中下', 's': '一␣', 'a': '一、', 'b': '（一）', 'c': '1、', 'd': '（1）', 'e': '①', 'g': '1）'}
DIV_RE = re.compile(rf'(?:大)?分(?:为)?({N})(?:品|科|大科|篇|章|节|段)?(?:\s*\d+\s*颂)?'
                    # 分几之后还跟品名或注：「分八 第一如来藏品」「分三缘起品」「分三果续（自相续果）」
                    rf'(?:\s*(?:第{N})?\s*[^\s、，。；（(]{{0,6}}?[品续](?:\s*[（(][^）)]{{1,10}}[）)])?)?$')
REF_RE = re.compile(r'[（(]表\s*([0-9a-zA-Z]+(?:-\d+)?)(?:\s*[～~\-]\s*(?:\d+-)?(\d+))?((?:[、，,]\s*\d+(?:-\d+)?)*)\s*[）)]')
NUMSTART = rf'[{STEMS}](?:{N}|初)、?|[{STEMS}]、|第{N}[品章节目篇]|{N}、|[（(]{N}[）)]|{D}[、）)]|[（(]{D}[）)]|[①-⑳]'


def strip_marks(s):
    s = re.sub(r'【[^】]{1,6}】', '', s)
    s = re.sub(r'[（(]\d+课(?:音频)?[）)]', '', s)
    return s.strip().replace('　', ' ').strip()


def parse_label(raw):
    s = strip_marks(raw)
    refs = []
    for a, b, more in REF_RE.findall(s):
        refs.append(a)
        base = a.rsplit('-', 1)[0] + '-' if '-' in a else ''
        refs += [(x if '-' in x else base + x) for x in (y.strip() for y in re.split(r'[、，,]', more)) if x]
        if b and '-' in a:
            base, k = a.rsplit('-', 1)
            refs += [f'{base}-{x}' for x in range(int(k) + 1, int(b) + 1)]
    s = REF_RE.sub('', s).strip()
    m = LABEL_RE.match(s)
    typ = num = width = bad = None
    rest = s
    if m:
        g = next(k for k in ('f', 'x', 'u', 'h', 'w', 'a', 'y', 's', 'b', 'c', 'd', 'g', 'e') if m.group(k))
        tok = m.group('fn') if g == 'f' else m.group(g)
        if g == 'f':
            typ = m.group('f')
        elif g == 'h':
            typ = '第' + m.group('hk')
        else:
            typ = TYPES[g]
        if g == 'e':
            num = CIRC.index(tok) + 1
        elif g == 'x':
            num = STEMS.index(tok) + 1
        elif g == 'u':
            num = None
        else:
            num = cn2int(tok)
        if g in 'cdg':
            width = '全角' if tok[0] in '０１２３４５６７８９' else '半角'
        lab = m.group(0)
        if re.search(r'[()]', lab) and re.search(r'[（）]', lab):
            bad = '括号全半角混用'
        elif g == 'c' and lab[-1] in '.．':
            bad = '编号后用了点号而不是顿号'
        elif g == 'f' and not lab.endswith('、'):
            bad = '层级字后面缺顿号'
        rest = s[m.end():]
    elif SUFFIX_RE.search(s):
        ms = SUFFIX_RE.search(s)
        typ, num, rest = '名称第N', cn2int(ms.group(1)), s[:ms.start()]
    div = None
    md = DIV_RE.search(rest)
    if md:
        div = cn2int(md.group(1)); rest = rest[:md.start()]
    elif typ and typ in STEMS and m and not m.group(0).endswith('、'):
        # 古式科判「丁二别释主伴二」：末尾数字即分几
        mt = re.match(rf'^(.+?)([二三四五六七八九十]|十[一二三四五六七八九])$', rest.strip())
        if mt and not re.search(r'第$', mt.group(1)):
            div = cn2int(mt.group(2)); rest = mt.group(1)
    return dict(raw=raw.strip(), type=typ, num=num, width=width, name=rest.strip(' ，,'), div=div, refs=refs, bad=bad)


SUFFIX_RE = re.compile(rf'^.{{2,16}}?第({N})$')
SPLIT_RE = re.compile(rf'((?:大)?分(?:为)?{N}(?:品|篇|章|节)?)(?={NUMSTART})')


def split_chain(text):
    out = []
    for p in SPLIT_RE.sub(r'\1\n', text).split('\n'):
        # 古式「丁二广释二戊初初别释」：遇到下一级层级字就断开
        while True:
            m0 = re.match(rf'([{STEMS}])(?:{N}|初)', p)
            if not m0 or STEMS.index(m0.group(1)) + 1 >= len(STEMS):
                break
            nxt = STEMS[STEMS.index(m0.group(1)) + 1]
            m = re.search(rf'{nxt}(?:{N}|初)', p[m0.end() + 1:])
            if not m:
                break
            cut = m0.end() + 1 + m.start()
            out.append(p[:cut]); p = p[cut:]
        out.append(p)
    return [x for x in out if x.strip()]


HEADER_WORDS = ('科判', '正文', '颂词', '颂文', '经文', '论文', '原文', '条目')


def is_label(text, strict=True):
    s = strip_marks(text)
    if not s or s.startswith('【') or any(s.startswith(w) for w in HEADER_WORDS) and len(s) < 16:
        return False
    if REF_RE.fullmatch(s):
        return False
    s2 = REF_RE.sub('', s).strip()
    if strict and len(s2) > 40 and re.search(r'[。；！？]', s2):
        return False
    return bool(LABEL_RE.match(s)) or bool(DIV_RE.search(s2)) or bool(SUFFIX_RE.search(s2))


# ---------------- 科判 docx ----------------

def in_ruby(el):
    """拼音指南（注音）里的字母不算正文"""
    return any(True for _ in el.iterancestors(qn('w:rt')))


def wtext(el):
    return ''.join(x.text or '' for x in el.iter(qn('w:t')) if not in_ruby(x))


def read_cells(tbl):
    cells, open_ = [], {}
    for ri, row in enumerate(tbl.tr_lst):
        c = 0
        for tc in row.tc_lst:
            pr = tc.tcPr
            sp = pr.find(qn('w:gridSpan')) if pr is not None else None
            sp = int(sp.get(qn('w:val'))) if sp is not None else 1
            vm = pr.find(qn('w:vMerge')) if pr is not None else None
            txt = wtext(tc).strip()
            if vm is not None and vm.get(qn('w:val')) != 'restart':
                if c in open_:
                    open_[c]['r1'] = ri
            else:
                cell = dict(r0=ri, r1=ri, c0=c, c1=c + sp, text=txt, tc=tc)
                cells.append(cell); open_[c] = cell
            c += sp
    return cells


class Node:
    def __init__(self, info, where, tc=None):
        self.__dict__.update(info)
        self.where = [where]
        self.tc = tc
        self.children = []
        self.text = []   # 正文
        self.parent = None

    def key(self):
        return (self.type, self.num) if self.type else ('name', self.name)

    def label(self):
        return self.raw


TITLE_RE = re.compile(r'^(表?)\s*([0-9a-zA-Z]+(?:-\d+)?)\s*[：:]\s*(?:[（(]\s*总?\s*(\d*)\s*表\s*[）)])?')
# 「表1-1：戊一、……（总6表）」：张数写在标题末尾
TITLE_TAIL_RE = re.compile(r'[（(]\s*总?\s*(\d*)\s*表\s*[）)]\s*$')


def match_title(t):
    m = TITLE_RE.match(t)
    if not m:
        return None
    if m.group(3) is not None:
        return dict(text=t, prefix=m.group(1), id=m.group(2), count=m.group(3))
    mt = TITLE_TAIL_RE.search(t)
    if mt:
        return dict(text=t, prefix=m.group(1), id=m.group(2), count=mt.group(1))
    if m.group(1) and len(t) > m.end():   # 「表5：丁三、……」只有一张表，可以不写张数
        return dict(text=t, prefix=m.group(1), id=m.group(2), count=None)
    return None


def table_titles(doc, issues=None):
    """按文档顺序把表格标题与表格对应起来"""
    body = doc.element.body
    out, last = [], None
    for el in body.iterchildren():
        if el.tag == qn('w:p'):
            t = wtext(el).strip()
            m = match_title(t)
            if m:
                last = m
            elif t:
                pass
        elif el.tag == qn('w:tbl'):
            if last and not last.get('used'):
                last['used'] = True; out.append(last)
            else:
                out.append(None)
            last = None
    if issues is not None:
        for i, t in enumerate(out):
            if t is None:
                issues.append(dict(level='中', kind='表格标题', where=f'第{i+1}个表格', msg='表格上方没有「表X：（N表）」标题'))
                continue
            if not t['prefix']:
                issues.append(dict(level='高', kind='表格标题', where=t['text'][:20], msg=f'标题「{t["text"][:16]}」开头少了「表」字'))
            if t['count'] == '':
                issues.append(dict(level='高', kind='表格标题', where=t['text'][:20], msg=f'标题「{t["text"][:16]}」的「（N表）」里漏了数字'))
        groups = {}
        for t in out:
            if t:
                groups.setdefault(t['id'].split('-')[0] + '-' if '-' in t['id'] else t['id'], []).append(t)
        for g, ts in groups.items():
            ids = [t['id'] for t in ts]
            if len(ids) != len(set(ids)):
                issues.append(dict(level='高', kind='表格标题', where=f'表{g}', msg=f'表号重复：{ids}'))
            if any('-' in x for x in ids):
                ks = [int(x.split('-')[1]) for x in ids if '-' in x]
                if ks != list(range(1, len(ks) + 1)):
                    issues.append(dict(level='高', kind='表格标题', where=f'表{g}', msg=f'分表序号不连续：{ids}'))
                for t in ts:
                    if t['count'] and int(t['count']) != len(ts):
                        issues.append(dict(level='高', kind='表格标题', where=t['text'][:20],
                                           msg=f'标题写「（{t["count"]}表）」，实际这一组有 {len(ts)} 张表（{"、".join(ids)}）'))
    return out


def build_kepan(path, issues):
    doc = docx.Document(path)
    titles = table_titles(doc, issues)
    root = Node(dict(raw='（全书）', type=None, num=None, width=None, name='（全书）', div=None, refs=[]), '')
    series = {}
    series_multi = len({t['id'][0] for t in titles if t and re.match(r'[a-zA-Z]', t['id'])}) > 1
    for ti, tbl in enumerate(doc.tables):
        tt = titles[ti] if ti < len(titles) else None
        tname = ('表' + tt['id']) if tt else f'第{ti+1}个表格'
        cells = read_cells(tbl._tbl)
        width = max(c['c1'] for c in cells)
        # 表头：找「正文/颂词」所在列，正文栏右边的科判（另一套分科）不参与
        text_col = None
        for c in cells:
            if c['r0'] <= 1 and strip_marks(c['text']) in ('正文', '颂词', '颂文', '经文', '论文', '原文'):
                text_col = (c['c0'], c['c1'])
                break
        if text_col:
            lab_cells = [c for c in cells if c['c0'] < text_col[0]]
            txt_cells = [c for c in cells if text_col[0] <= c['c0'] < text_col[1]]
            txt_cells += [c for c in lab_cells if c['text'].startswith('【') and not is_label(c['text'])]
            # 颂词栏里横排的短科判（如「乙四、取名必要」）仍是科判
            moved = [c for c in txt_cells if c['text'] and len(c['text']) < 40 and is_label(c['text'])
                     and not re.search(r'[，。；]', c['text'])]
            txt_cells = [c for c in txt_cells if c not in moved]
            lab_cells = [c for c in lab_cells if c not in txt_cells] + moved
            # 科判格右边、同一行再没有科判的非科判格：是颂词（颂词格往左伸进了科判栏）
            labs0 = [c for c in lab_cells if is_label(c['text'], strict=False)]
            for c in list(lab_cells):
                if c in labs0 or not c['text']:
                    continue
                left = any(x['r0'] <= c['r0'] <= x['r1'] and x['c1'] <= c['c0'] for x in labs0)
                right = any(x['r0'] <= c['r0'] <= x['r1'] and x['c0'] >= c['c1'] for x in labs0)
                if left and not right:
                    lab_cells.remove(c); txt_cells.append(c)
        else:
            txt_cells = [c for c in cells if c['c1'] == width and c['text'] and not is_label(c['text'])]
            # 最右栏里「1.……」这种带解释的条目：有一条算正文，同栏同类的都算正文
            longt = {parse_label(c['text'])['type'] for c in txt_cells if LABEL_RE.match(strip_marks(c['text']))}
            txt_cells += [c for c in cells if c['c1'] == width and c not in txt_cells and c['text']
                          and parse_label(c['text'])['type'] in longt - {None}]
            lab_cells = [c for c in cells if c not in txt_cells]
        labels = [c for c in lab_cells if is_label(c['text'], strict=not text_col)]
        texts = [c for c in txt_cells if c['text'] and strip_marks(c['text']) not in HEADER_WORDS
                 and REF_RE.sub('', strip_marks(c['text'])).strip()
                 and not (len(c['text']) < 60 and is_label(c['text']) and not re.search(r'[，。；]', c['text']))]
        # 标题写「第N品」，表里的品却是别的
        if tt:
            mt = re.search(rf'第({N})品', tt['text'])
            pins = {parse_label(c['text'])['num'] for c in labels if parse_label(c['text'])['type'] == '第品'}
            if mt and pins and cn2int(mt.group(1)) not in pins:
                issues.append(dict(level='高', kind='表格标题', where=tname,
                                   msg=f'标题「{tt["text"][:30]}」写第{mt.group(1)}品，表里的科判却是' + '、'.join(f'第{x}品' for x in sorted(pins))))
        for c in lab_cells:
            s = strip_marks(c['text'])
            if c['c0'] == 0 and c['c1'] == width:
                continue   # 横贯整张表的一行：表前说明、「……终」之类
            if s and c not in labels and not any(s.startswith(w) for w in HEADER_WORDS) and not REF_RE.fullmatch(s):
                issues.append(dict(level='低' if re.fullmatch(r'[（(].*', s) or len(re.sub(r'[（(][^）)]*[）)]', '', REF_RE.sub('', s)).strip()) <= 6 else '中', kind='版面', where=tname, msg=f'科判栏里有一格不像科判（没有编号）：{s[:24]}'))
        for c in labels:
            parts = split_chain(c['text'])
            chain = [Node(parse_label(p), tname, c['tc']) for p in parts]
            for nd in chain:
                nd._cell = (c['c0'], c['r0'])
            for a, b in zip(chain, chain[1:]):
                a.children.append(b); b.parent = a
            c['head'], c['tail'] = chain[0], chain[-1]
        for c in labels:
            # 同一行左边有同级科判（横排的兄弟），父科就跟它一样
            sib = [p for p in labels if p is not c and p['r0'] == c['r0'] and p['r1'] == c['r1'] and p['c1'] <= c['c0'] and p.get('nested')
                   and not any(x is not p and x['r0'] == c['r0'] and p['c1'] <= x['c0'] and x['c1'] <= c['c0'] for x in labels)
                   and p['head'].type and p['head'].type == c['head'].type and p['head'].parent is not None
                   and p['head'].num and c['head'].num == p['head'].num + 1]
            if sib:
                par = max(sib, key=lambda p: p['c1'])['head'].parent
                par.children.append(c['head']); c['head'].parent = par
                c['nested'] = True
                continue
            cands = [p for p in labels if p['c1'] <= c['c0'] and p['r0'] <= c['r0'] and p['r1'] >= c['r1'] and p is not c
                     and ((p['r1'] - p['r0'] > c['r1'] - c['r0']) or p['c1'] == c['c0']
                          or not any(x['text'] for x in cells if x['c0'] >= p['c1'] and x['c1'] <= c['c0'] and x['r0'] <= c['r0'] <= x['r1']))]
            if cands:
                par = max(cands, key=lambda p: p['c1'])
                par['tail'].children.append(c['head']); c['head'].parent = par['tail']
            c['nested'] = bool(cands)
        for c in texts:
            cands = [p for p in labels if p['c1'] <= c['c0'] and p['r0'] <= c['r0'] and p['r1'] >= c['r1']]
            if not cands:
                cands = [p for p in labels if p['r0'] <= c['r0'] <= p['r1']]
            if not cands:
                continue
            par = max(cands, key=lambda p: p['c1'])
            par['tail'].text.append(c['text'])
        seen_par = set()
        for c in labels:
            par = c['head'].parent
            if par is None or id(par) in seen_par:
                continue
            seen_par.add(id(par))
            kids = sorted([k for k in par.children if getattr(k, '_cell', None) and k.where[0] == tname], key=lambda k: k._cell)
            nums = sorted({k.num for k in kids if k.type and k.num})
            for x, y in zip(nums, nums[1:]):
                if y != x + 1:
                    issues.append(dict(level='高', kind='序号', where=tname,
                                       msg=f'「{par.raw}」底下序号 {x} 之后接 {y}：' + '、'.join(k.raw[:10] for k in par.children)))
                    break
        tops = [c['head'] for c in labels if not c['nested']]
        target = root
        if tt and series_multi and re.match(r'[b-zB-Z]', tt['id']):
            target = series.setdefault(tt['id'][0], None)
            if target is None:
                target = Node(dict(raw=f'（{tt["id"][0]}系列：{re.sub(r"^.*?表[）)]", "", tt["text"]).strip()[:12]}）', type=None, num=None, width=None, name=f'（{tt["id"][0]}系列）', div=None, refs=[]), '')
                target.pseudo = True
                series[tt['id'][0]] = target
                root.children.append(target); target.parent = root
        for t in tops:
            ex = find_same(target, t, tname) if t.type and target.children and not any(k.key() == t.key() for k in target.children) else None
            merge(ex.parent if ex is not None else target, t, issues)
    return root, doc


def find_same(root, node, tname=''):
    """分表从半中间开始（如从「丁初」起）：到已有的科判树里找同一个科判"""
    a = name_core(node.name)
    cands = []
    for n, _ in walk(root):
        if n is not root and n.key() == node.key() and n.parent is not None:
            b = name_core(n.name)
            if a and b and (a == b or a.startswith(b) or b.startswith(a) or paren_eq(a, b)):
                cands.append(n)
    if not cands:
        return None
    def refd(n):   # 这个科判或它的子孙引用了本表
        return any(tname == '表' + r or tname.startswith('表' + r + '-') for m, _ in walk(n) for r in m.refs)
    return max(cands, key=lambda n: (refd(n), name_core(n.name) == a))


def merge(parent, node, issues):
    for ex in parent.children:
        if ex.key() == node.key():
            if ex.name != node.name and not paren_eq(ex.name, node.name):
                a, b = sorted([ex.name, node.name], key=len)
                if b.startswith(a):
                    issues.append(dict(level='低', kind='前后一致', where=f'{ex.where[0]} / {node.where[0]}',
                                       msg=f'同一科判一处写全、一处写简：「{b}」／「{a}」'))
                else:
                    issues.append(dict(level='高', kind='前后一致', where=f'{ex.where[0]} / {node.where[0]}',
                                       msg=f'同一科判两处写法不同：「{ex.raw}」vs「{node.raw}」'))
            if ex.div is None and node.div is not None:
                ex.div = node.div
            elif node.div is not None and ex.div != node.div:
                issues.append(dict(level='高', kind='前后一致', where=f'{ex.where[0]} / {node.where[0]}',
                                   msg=f'「{ex.name}」一处写分{ex.div}，一处写分{node.div}'))
            ex.where.append(node.where[0])
            ex.refs += node.refs
            ex.text += node.text
            if ex.tc is None or (not ex.text and node.text):
                pass
            for ch in node.children:
                merge(ex, ch, issues)
            return ex
    parent.children.append(node); node.parent = parent
    return node


def walk(n, depth=0):
    yield n, depth
    for c in n.children:
        yield from walk(c, depth + 1)


def check_structure(root, issues, tables_present):
    nodes = [n for n, _ in walk(root)]
    # 本书统一采用的写法（多数如此）就不当错误
    bads = {}
    for n in nodes:
        if n.type:
            bads.setdefault(n.type, [0, 0])
            bads[n.type][0] += 1
            if n.bad:
                bads[n.type][1] += 1
    house = {t for t, (a, b) in bads.items() if a and b / a > 0.5}
    for t in house:
        ex = next(n.bad for n in nodes if n.type == t and n.bad)
        issues.append(dict(level='低', kind='本书体例', where='', msg=f'「{t}」类编号本书多数如此（{ex}），当作本书体例，不逐条报'))
    multi = [n for n in nodes if len(n.children) > 1 and n.parent is not None]
    no_div_ok = multi and sum(1 for n in multi if n.div is None) / len(multi) > 0.5
    prev_last = {}
    for n in nodes:
        if getattr(n, 'pseudo', False):
            continue
        ks = n.children
        where = '、'.join(dict.fromkeys(n.where)) if n.where[0] else ''
        if n.div is not None and not ks and n.text:
            heads_ = [h for h in (parse_label(t) for t in n.text if LABEL_RE.match(strip_marks(t))) if h['type'] != n.type]
            if sorted(h['num'] for h in heads_ if h['num']) == list(range(1, n.div + 1)):
                continue   # 子科写在正文格里（「1.……」带解释）
        if n.div is not None and len(ks) != n.div:
            issues.append(dict(level='高', kind='分数', where=where,
                               msg=f'「{n.raw}」写分{n.div}，实际有 {len(ks)} 个子科判：' + '、'.join(k.raw for k in ks)))
        if n.div is None and len(ks) > 1 and n.parent is not None and not no_div_ok:
            issues.append(dict(level='中', kind='分数', where=where, msg=f'「{n.raw}」底下有 {len(ks)} 个子科判，但没写「分{len(ks)}」'))
        if getattr(n, 'bad', None) and n.type not in house:
            issues.append(dict(level='高', kind='编号写法', where=where, msg=f'「{n.raw}」{n.bad}'))
        if n.type and len(n.type) == 1 and n.type in STEMS:
            nxt = STEMS[STEMS.index(n.type) + 1] if STEMS.index(n.type) + 1 < len(STEMS) else None
            for k in ks:
                if k.type and len(k.type) == 1 and k.type in STEMS and k.type != nxt:
                    issues.append(dict(level='高', kind='层级字', where='、'.join(dict.fromkeys(k.where)),
                                       msg=f'「{n.raw}」底下应接「{nxt}」，却写成「{k.raw}」'))
        typs = {k.type for k in ks if k.type}
        if len(typs) > 1:
            issues.append(dict(level='高', kind='层级字', where=where, msg=f'「{n.raw}」底下同级编号样式不一：' + '、'.join(k.raw for k in ks)))
        nums = [k.num for k in ks if k.type and k.num]
        # 「2、」底下用「21、22、」这种层层相接的编号
        if n.num and nums and all(len(str(x)) == len(str(n.num)) + 1 and str(x).startswith(str(n.num)) for x in nums):
            nums = [x % 10 for x in nums]
        ktyp = ks[0].type if ks else None
        cont = nums and nums[0] > 1 and prev_last.get(ktyp) == nums[0] - 1 and sorted(nums) == list(range(nums[0], nums[0] + len(nums)))
        if nums and ktyp:
            prev_last[ktyp] = nums[-1]
        if nums and not cont and sorted(nums) != list(range(1, len(nums) + 1)):
            issues.append(dict(level='高', kind='序号', where=where, msg=f'「{n.raw}」底下序号不连续：{nums}'))
        widths = {k.width for k in ks if k.width}
        if len(widths) > 1:
            fw = [k.raw for k in ks if k.width == '全角']; hw = [k.raw for k in ks if k.width == '半角']
            issues.append(dict(level='高', kind='编号写法', where=where,
                               msg=f'「{n.raw}」底下全角半角数字混用：全角 {"、".join(x[:6] for x in fw)}；半角 {"、".join(x[:6] for x in hw)}'))
        for r in n.refs:
            if f'表{r}' not in tables_present and not any(t.startswith(f'表{r}-') for t in tables_present):
                issues.append(dict(level='高', kind='跨表引用', where=where, msg=f'「{n.raw}」引用（表{r}），但文档里没有表{r}'))
            elif f'表{r}' not in n.where and not any(w.startswith(f'表{r}-') for w in n.where):
                near = '-' in r and any(w.startswith('表' + r.rsplit('-', 1)[0] + '-') and w.rsplit('-', 1)[-1].isdigit()
                                        and abs(int(w.rsplit('-', 1)[-1]) - int(r.rsplit('-', 1)[-1])) == 1 for w in n.where)
                issues.append(dict(level='低' if near else '中', kind='跨表引用', where=where, msg=f'「{n.raw}」引用（表{r}），但表{r}里没有这个科判'))


# ---------------- 讲记 docx ----------------

def run_font(r):
    f = r.font.name
    if f is None and r._r.rPr is not None and r._r.rPr.rFonts is not None:
        f = r._r.rPr.rFonts.get(qn('w:eastAsia'))
    return f


def ptext(p):
    """段落全文，包括 smartTag、修订插入等 python-docx 的 p.text 会漏掉的文字"""
    out = []
    for el in p._p.iter(qn('w:t'), qn('w:tab'), qn('w:br')):
        if in_ruby(el):
            continue
        out.append(el.text or '' if el.tag == qn('w:t') else ('\t' if el.tag == qn('w:tab') else ''))
    return ''.join(out)


def first_font(p):
    for r in p.runs:
        if r.text.strip():
            return run_font(r)
    return None


ITEM_RE = re.compile(rf"(?<![0-9０-９一二三四五六七八九十百（(])(?=(?:[{STEMS}]{N}、|{N}、|[（(]{N}[）)]|[（(]{D}[）)]|{D}[、）)]|[①-⑳]))")


def split_items(s):
    return [x.strip(' 　；;。，,') for x in ITEM_RE.split(s.strip()) if x.strip(' 　；;。，,')]


def norm_text(s):
    s = re.sub(r'【[^】]{1,6}】', '', s)
    s = re.sub(r'[（(][a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]+[）)]', '', s)
    s = re.sub(r'[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+', '', s)
    return re.sub(r'[\s　，。、；：？！“”‘’「」『』（）()【】·—…,.;:?!《》〈〉\'"]', '', s)


def grams(s, n=4):
    return {s[i:i + n] for i in range(len(s) - n + 1)}


def is_toc(t):
    return bool(re.search(r'(\t|…|\.{3,})\s*\d+$', t))


def pdf_paragraphs(path):
    """PDF 讲记：把同一字体、连续的行并成段落；返回 (位置, 文字, 字体, 样式)"""
    import pdfplumber
    out, cur = [], None
    with pdfplumber.open(path) as pdf:
        for pno, pg in enumerate(pdf.pages, 1):
            for ln in pg.extract_text_lines():
                t = ln['text'].replace('\ue5e5', ' ').strip()
                ch = ln['chars'][0]
                size = round(ch['size'])
                font = ch['fontname'].split('+')[-1]
                if size <= 9 or re.fullmatch(r'\d+|.{0,12}\s\d+|\d+\s.{0,12}', t):
                    continue   # 页眉页脚
                key = (font, size)
                if cur and cur['key'] == key and not re.search(r'[。！？」”]$', cur['t']):
                    cur['t'] += t
                else:
                    if cur:
                        out.append((cur['pos'], cur['t'], f'{font}', 'Normal'))
                    cur = dict(key=key, t=t, pos=pno)
                if re.search(r'[。！？」”]$', t) or LABEL_RE.match(t):
                    out.append((cur['pos'], cur['t'], f'{cur["key"][0]}', 'Normal')); cur = None
        if cur:
            out.append((cur['pos'], cur['t'], f'{cur["key"][0]}', 'Normal'))
    return out


ALLP = []   # 讲记里的短段落 (段号, 文字, 字体)
ALLJ = []   # 讲记全部段落（规范化后），用来判断「讲记里有没有」


def read_jiangji(path, K):
    Kg = grams(K)
    ps = []
    in_q = False
    if path.lower().endswith('.pdf'):
        raw = pdf_paragraphs(path)
    else:
        doc = docx.Document(path)
        raw = [(i, ptext(p).strip(), first_font(p), p.style.name) for i, p in enumerate(doc.paragraphs)]
    for i, t, f, st in raw:
        if not t or is_toc(t):
            continue
        if re.sub(r'\s', '', t) in ('思考题',):
            in_q = True
            continue
        if in_q:
            if re.match(r'^[0-9０-９]+[、.．]', t) or re.search(r'[？?]', t):
                continue   # 思考题的题目
            in_q = False
        ps.append((i, t, f, st))
    # 1. 认标题字体：编号开头的短段落最多用的字体
    cand, tot = {}, {}
    for i, t, f, st in ps:
        tot[f] = tot.get(f, 0) + 1
        if len(t) < 120 and (LABEL_RE.match(t) or re.match(r'^(初中|初又|今初|分[一二三四五六七八九十])', t)):
            cand[f] = cand.get(f, 0) + 1
    head_fonts = {f for f in cand if f and cand[f] >= 3 and cand[f] / tot[f] >= 0.3}
    heads, sutra, other_heads = [], [], 0
    ALLJ[:] = [norm_text(t) for _, t, _, _ in ps]
    ALLP[:] = [(i, t, f) for i, t, f, _ in ps if len(t) <= 80]
    for i, t, f, st in ps:
        is_head = f in head_fonts or st.startswith('Heading')
        if is_head and len(t) < 160:
            m = re.match(r'^([^：:]{0,60})[：:](.+)$', t)
            plain = [x.strip(' 　。，,') for x in re.split(r'[；;]', m.group(2)) if x.strip(' 　。，,')] if m else []
            if m and ((split_items(m.group(2)) and LABEL_RE.match(split_items(m.group(2))[0]))
                      or (len(plain) >= 2 and DIV_RE.search(m.group(1).strip()) and not LABEL_RE.match(plain[0]))):
                left = re.split(r'[；;]', m.group(1).strip())[-1].strip()
                items = split_items(m.group(2)) if LABEL_RE.match(m.group(2).strip()) else plain
                dl = dict(items=items, para=i, n=None, text=t)
                md = DIV_RE.search(left)
                if md:
                    dl['n'] = cn2int(md.group(1))
                if LABEL_RE.match(left) or (not re.match(r'^(初中|初又|今初|次|初|分)', left) and len(left) > 2 and md):
                    info = parse_label(left)
                    heads.append(dict(info=info, para=i, text=left, divline=dl))
                else:
                    heads.append(dict(info=None, para=i, text=t, divline=dl))
                continue
            if re.match(r'^今初', t):
                continue
            if LABEL_RE.match(t):
                heads.append(dict(info=parse_label(t), para=i, text=t, divline=None))
                continue
            if len(t) <= 40 and not re.search(r'[。！？]', t):
                heads.append(dict(info=parse_label(t), para=i, text=t, divline=None))
            other_heads += 1
            continue
        nt = norm_text(t)
        if len(nt) >= 6:
            g = grams(nt)
            if g and len(g & Kg) / len(g) >= 0.5:
                sutra.append((i, t, nt))
    return heads, sutra, head_fonts


def name_core(s):
    s = re.sub(r'[。，；]$', '', s)
    s = re.sub(r'[（(][^）)]*[）)]$', '', s).strip()
    s = s.split('——')[0].strip() if '——' in s and not s.startswith('第') else s
    return s


def is_subseq(a, b):
    it = iter(b)
    return all(ch in it for ch in a)


def paren_eq(a, b):
    """总表里用括号注出异译：「觉性(悟)本体(之)菩提义」与「觉性本体之菩提义」算同一个"""
    a, b = re.sub(r'\s', '', a), re.sub(r'\s', '', b)
    if a == b:
        return True
    for x, y in ((a, b), (b, a)):
        if re.search(r'[（(]', x):
            x1 = re.sub(r'[（(][^）)]*[）)]', '', x)
            x2 = re.sub(r'[（()）]', '', x)
            if x1 and is_subseq(x1, y) and is_subseq(y, x2):
                return True
    return False


def sim(a, b):
    return difflib.SequenceMatcher(None, a, b).ratio()


def mark_diff(a, b):
    """把两串文字的不同处用〔〕标出"""
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    oa, ob = [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            oa.append(a[i1:i2]); ob.append(b[j1:j2])
        else:
            oa.append(f'〔{a[i1:i2] or "　"}〕'); ob.append(f'〔{b[j1:j2] or "　"}〕')
    return ''.join(oa), ''.join(ob)


def label_eq(info, n):
    if info['num'] != n.num:
        return False
    # 讲记分科常用「一、二、」泛称各级（甲一、乙一……）
    return info['type'] == n.type or (info['type'] == '一、' and n.type in STEMS)


def check_divline(dl, n, issues):
    where = f'讲记第{dl["para"]+1}段'
    k = len(n.children)
    cnt = dl['n'] if dl['n'] is not None else None
    if cnt is not None and cnt != len(dl['items']):
        issues.append(dict(level='高', kind='分数', where=where,
                           msg=f'讲记写「分{cnt}」，后面却列了 {len(dl["items"])} 项：{"；".join(dl["items"])}'))
    if len(dl['items']) != k:
        issues.append(dict(level='高', kind='科判对照讲记', where=where,
                           msg=f'讲记列出「{n.name}」下 {len(dl["items"])} 科，科判表有 {k} 科'))
    for ch in n.children:
        ch._mentioned = True
    for it, ch in zip(dl['items'], n.children):
        pi = parse_label(it)
        a, b = name_core(ch.name), name_core(pi['name'])
        if pi['type'] and not label_eq(pi, ch):
            issues.append(dict(level='高', kind='科判对照讲记', where=where,
                               msg=f'编号不同：讲记分科列表写「{it}」，科判表是「{ch.raw}」'))
        elif a != b:
            x, y = mark_diff(a, b)
            issues.append(dict(level='中', kind='科判名称', where=f'{ch.where[0]} / {where}',
                               msg=f'科判表「{x}」，讲记分科列表「{y}」'))


def align(root, heads, issues):
    kp = [n for n, d in walk(root) if n.parent is not None and not getattr(n, 'pseudo', False)]
    with_kids = [n for n in kp if n.children]
    ptr = 0
    matched = {}
    pending_lists = []
    used_types = {n.type for n in kp if n.type}
    for h in heads:
        hi = h['info']
        if hi is None:
            dl = h['divline']
            cands = []
            for j, n in enumerate(kp):
                if not n.children:
                    continue
                pairs = list(zip(dl['items'], n.children))
                sc = sum(sim(name_core(parse_label(it)['name']), name_core(c.name)) for it, c in pairs) / max(len(dl['items']), len(n.children))
                if sc >= 0.4:
                    cands.append((j, sc, n))
            if cands:
                top = max(c[1] for c in cands)
                good = [c for c in cands if c[1] >= top - 0.15]
                after = [c for c in good if c[0] >= ptr - 1]
                j, sc, n = min(after or good, key=lambda c: abs(c[0] - (ptr - 1)))
                check_divline(dl, n, issues)
            else:
                issues.append(dict(level='中', kind='科判对照讲记', where=f'讲记第{dl["para"]+1}段',
                                   msg=f'讲记分科列表「{dl["text"][:30]}」在科判表里找不到对应的一组科判'))
            continue
        if hi['type'] and hi['type'] not in used_types:
            continue
        best = None
        for j in range(ptr, min(len(kp), ptr + 60)):
            n = kp[j]
            s_ = sim(name_core(n.name), name_core(hi['name']))
            if hi['type'] and label_eq(hi, n):
                if s_ >= 0.4 or name_core(hi['name']).startswith(name_core(n.name)):
                    best = j; break
            elif not hi['type'] and s_ >= 0.8:
                best = j
                if n.type:
                    issues.append(dict(level='低', kind='讲记标题无编号', where=f'讲记第{h["para"]+1}段',
                                       msg=f'讲记标题「{h["text"]}」没有编号，科判表是「{n.raw}」'))
                break
        if best is None and hi['type']:
            for j in range(ptr, len(kp)):
                n = kp[j]
                if label_eq(hi, n) and sim(name_core(n.name), name_core(hi['name'])) >= 0.6:
                    best = j; break
        if best is None:
            # 编号对不上但名称相同：多半是讲记编号写错
            for j in range(ptr, min(len(kp), ptr + 60)):
                n = kp[j]
                if name_core(n.name) == name_core(hi['name']) and len(name_core(n.name)) >= 3:
                    issues.append(dict(level='高', kind='科判对照讲记', where=f'讲记第{h["para"]+1}段',
                                       msg=f'编号不同：讲记标题「{h["text"]}」，科判表是「{n.raw}」'))
                    best = j; break
        if best is None:
            if hi['type']:
                issues.append(dict(level='中', kind='科判对照讲记', where=f'讲记第{h["para"]+1}段',
                                   msg=f'讲记有标题「{h["text"]}」，科判表里找不到对应科判'))
            continue
        n = kp[best]
        matched[id(n)] = h
        for m in kp[ptr:best]:
            if id(m) not in matched:
                m._skipped = h
        if hi.get('bad'):
            issues.append(dict(level='高', kind='编号写法', where=f'讲记第{h["para"]+1}段', msg=f'讲记标题「{h["text"]}」{hi["bad"]}'))
        if re.search(r'[。，；]$', h['text']) and not h['divline'] and '：' not in h['text']:
            issues.append(dict(level='中', kind='编号写法', where=f'讲记第{h["para"]+1}段', msg=f'讲记标题「{h["text"]}」末尾多了标点'))
        a, b = name_core(n.name), name_core(hi['name'])
        if a != b and not b.startswith(a):
            x, y = mark_diff(a, b)
            issues.append(dict(level='中', kind='科判名称', where=f'{n.where[0]} / 讲记第{h["para"]+1}段',
                               msg=f'科判表「{x}」，讲记标题「{y}」'))
        if hi['div'] is not None and n.div is not None and hi['div'] != n.div:
            issues.append(dict(level='高', kind='分数', where=f'{n.where[0]} / 讲记第{h["para"]+1}段',
                               msg=f'「{n.name}」科判表写分{n.div}，讲记写分{hi["div"]}'))
        if h['divline']:
            check_divline(h['divline'], n, issues)
        ptr = best + 1
    # 没有挂在标题上的分科列表（「初中分四：……」「分三：……」）：按子科名称找对应科判
    for dl in pending_lists:
        best, bs = None, 0
        for n in with_kids:
            pairs = list(zip(dl['items'], n.children))
            if not pairs:
                continue
            sc = sum(sim(name_core(parse_label(it)['name']), name_core(c.name)) for it, c in pairs) / max(len(dl['items']), len(n.children))
            if sc > bs:
                best, bs = n, sc
        if best is not None and bs >= 0.4:
            check_divline(dl, best, issues)
        else:
            issues.append(dict(level='中', kind='科判对照讲记', where=f'讲记第{dl["para"]+1}段',
                               msg=f'讲记分科列表「{dl["text"][:30]}」在科判表里找不到对应的一组科判'))
    cover = len(matched) / max(1, len(kp))
    if cover >= 0.3:
        def missing(n):
            return id(n) not in matched and not getattr(n, '_mentioned', False) and not (n.children and all(id(c) in matched for c in n.children[:1]))
        kpset = {id(x) for x in kp}
        def body_head(n):
            want = norm_text(REF_RE.sub('', strip_marks(n.raw)))
            want = re.sub(rf'(?:大)?分(?:为)?{N}$', '', want)
            for i, t, f in ALLP:
                nt = norm_text(t)
                if len(want) >= 3 and nt.startswith(want) and len(nt) <= len(want) + 4:
                    return i, f
            return None
        for n in kp:
            if missing(n) and (bh := body_head(n)):
                matched[id(n)] = None
                issues.append(dict(level='低', kind='讲记标题格式', where=f'讲记第{bh[0]+1}段',
                                   msg=f'讲记有「{n.raw}」这个标题，但用的是正文字体（{bh[1]}），没用标题字体'))
        for n in kp:
            if not missing(n):
                continue
            if id(n.parent) in kpset and missing(n.parent):
                continue   # 上一级已经报了
            sub = [m for m, _ in walk(n) if m is not n and missing(m)]
            where = '、'.join(dict.fromkeys(n.where))
            if len(sub) >= 3:
                issues.append(dict(level='中', kind='科判对照讲记', where=where, msg=f'科判表有「{n.raw}」及其下 {len(sub)} 个科判，讲记里都没有这些标题（讲记可能不含这一部分）'))
            else:
                issues.append(dict(level='中', kind='科判对照讲记', where=where, msg=f'科判表有「{n.raw}」，讲记里没有这个标题'))
                for m in sub:
                    issues.append(dict(level='中', kind='科判对照讲记', where='、'.join(dict.fromkeys(m.where)), msg=f'科判表有「{m.raw}」，讲记里没有这个标题'))
    return matched, cover


def is_variant(x, y):
    return len(x) == len(y) and all(any(cx in v and cy in v for v in VARIANTS) for cx, cy in zip(x, y))


def kepan_text(root):
    """科判表正文连成一串，并记住每个字属于哪个科判"""
    K, owner = [], []
    for n, _ in walk(root):
        for t in n.text:
            if re.search(r'(造颂|译讲|译释|编述|奉诏译|整理)', t[:60]):
                continue   # 书名、作者、译者那一格
            nt = norm_text(t)
            K.append(nt); owner += [n] * len(nt)
    return ''.join(K), owner


def check_sutra(root, K, owner, sutra, issues, pdf=False):
    idx = {}
    for i in range(len(K) - 3):
        idx.setdefault(K[i:i + 4], []).append(i)
    covered = bytearray(len(K))
    exact = {}   # 位置 -> {(讲记段落, 第几个相同块)}
    diffs = {}
    for para, t, nt in sutra:
        votes = {}
        for j in range(len(nt) - 3):
            for pos in idx.get(nt[j:j + 4], ())[:50]:
                votes[pos - j] = votes.get(pos - j, 0) + 1
        if not votes:
            continue
        o = max(votes, key=votes.get)
        lo, hi = max(0, o - 12), min(len(K), o + len(nt) + 12)
        win = K[lo:hi]
        sm = difflib.SequenceMatcher(None, nt, win, autojunk=False)
        blocks = [b for b in sm.get_matching_blocks() if b.size]
        if not blocks:
            continue
        ws, we = blocks[0].b, blocks[-1].b + blocks[-1].size
        if sum(b.size for b in blocks) / len(nt) < 0.85:
            continue   # 讲记里转述经文，不是引经文
        for bi, b in enumerate(blocks):
            for q in range(lo + b.b, lo + b.b + b.size):
                covered[q] = 1
                exact.setdefault(q, set()).add((para, bi))
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'equal' or j2 <= ws or j1 >= we:
                continue
            if i2 <= blocks[0].a or i1 >= blocks[-1].a + blocks[-1].size:
                continue
            x, y = win[j1:j2], nt[i1:i2]   # x=科判, y=讲记
            if len(x) > 15 or len(y) > 15:
                continue
            gpos = lo + j1
            key = (gpos, x, y)
            diffs.setdefault(key, []).append(para)
    for (gpos, x, y), paras in sorted(diffs.items()):
        n = owner[min(gpos, len(owner) - 1)]
        ctx = f'…{K[max(0, gpos-6):gpos]}〔{x or "　"}〕{K[gpos+len(x):gpos+len(x)+6]}…'
        var = is_variant(x, y)
        where = f'{n.where[-1]}「{n.raw[:16]}」/ 讲记第{"、".join(str(p+1) for p in sorted(set(paras))[:3])}{"页" if pdf else "段"}'
        span = range(max(0, gpos - 1), min(len(K), gpos + max(1, len(x)) + 1))
        sets = [exact.get(q, set()) for q in span]
        common = set.intersection(*sets) if sets else set()
        agree = any(pp not in paras for pp, _ in common)
        if agree:
            issues.append(dict(level='低', kind='讲记前后不一', where=where,
                               msg=f'科判表 {ctx}；讲记里有的地方与科判表相同，有的地方作〔{y or "（无）"}〕'))
            continue
        issues.append(dict(level='低' if var else ('高' if len(set(paras)) >= 2 else '中'),
                           kind='经文异体字' if var else '经文用字', where=where,
                           msg=f'科判表 {ctx}，讲记作〔{y or "（无）"}〕' + (f'（讲记有 {len(set(paras))} 处都这样写）' if len(set(paras)) >= 2 else '')))
    # 科判正文里讲记完全没有的部分
    J = '\n'.join(ALLJ) if ALLJ else '\n'.join(nt for _, _, nt in sutra)
    def found(seg):
        ch = [seg[x:x + 5] for x in range(0, max(1, len(seg) - 4))]
        return sum(c in J for c in ch) / len(ch) >= 0.75
    q = 0
    while q < len(K):
        if not covered[q]:
            r = q
            while r < len(K) and not covered[r]:
                r += 1
            if r - q >= 8 and not found(K[q:r]) and any(len(norm_text(t)) > 12 for nn in {id(x): x for x in owner[q:r]}.values() for t in nn.text):
                n = owner[q]
                if r - q > 3000 or r - q > len(K) * 0.3:
                    issues.append(dict(level='高', kind='讲记不全', where=f'{n.where[-1]}「{n.raw[:16]}」起',
                                       msg=f'科判表从这里开始有一大段正文（{r-q}字，约占全部 {100*(r-q)//max(1,len(K))}%）在讲记里都找不到，可能讲记文件不全或选错了文件'))
                    q = r
                    continue
                issues.append(dict(level='中', kind='经文覆盖', where=f'{n.where[-1]}「{n.raw[:16]}」',
                                   msg=f'科判表正文有「{K[q:q+24]}{"…" if r-q > 24 else ""}」（{r-q}字），讲记里找不到'))
            q = r
        else:
            q += 1


def check_meter(root, issues):
    """颂词每句字数应当一样"""
    for n, _ in walk(root):
        for t in n.text:
            body = re.sub(r'【[^】]*】', '', t)
            segs = [x for x in re.split(r'[，,。；;？?！!]', body) if x.strip()]
            segs = [re.sub(r'[\s　“”‘’「」『』：:]', '', x) for x in segs]
            if len(segs) < 4:
                continue
            lens = [len(x) for x in segs]
            L = max(set(lens), key=lens.count)
            if L not in (5, 7, 9, 11) or lens.count(L) / len(lens) < 0.75:
                continue
            for x in segs:
                if len(x) != L and abs(len(x) - L) <= 2:
                    issues.append(dict(level='中', kind='颂词字数', where=f'{n.where[-1]}「{n.raw[:16]}」',
                                       msg=f'这一格颂词每句 {L} 字，「{x}」却是 {len(x)} 字，可能漏字或多字'))


JJ_KINDS = ('讲记前后不一', '讲记标题格式', '讲记标题无编号', '讲记不全')
ORDER = {'高': 0, '中': 1, '低': 2}


def jiangji_only(i):
    """只是讲记自己的问题（科判表没错）：不标在科判上，最后提醒一句"""
    return i['kind'] in JJ_KINDS or (i['where'].startswith('讲记第') and (
        i['kind'] == '编号写法' or '讲记写「分' in i['msg'] or '科判表里找不到' in i['msg'] or '讲记分科列表' in i['msg']))


def run_check(kpath, jpath=None):
    issues = []
    root, kdoc = build_kepan(kpath, issues)
    tabs = {'表' + t['id'] for t in table_titles(kdoc) if t}
    check_structure(root, issues, tabs)
    check_meter(root, issues)
    nk = sum(1 for _ in walk(root)) - 1
    stats = dict(科判数=nk)
    if jpath:
        K, owner = kepan_text(root)
        heads, sutra, hf = read_jiangji(jpath, K)
        stats['讲记标题字体'] = '、'.join(str(x) for x in hf)
        stats['讲记标题数'] = len(heads)
        matched, cover = align(root, heads, issues)
        stats['对上的标题'] = len(matched)
        if cover < 0.3:
            stats['说明'] = '讲记里没有逐科标题，只比对经文/颂词'
        stats['讲记经文段落'] = len(sutra)
        check_sutra(root, K, owner, sutra, issues, pdf=jpath.lower().endswith('.pdf'))
    seen = set(); uniq = []
    for i in issues:
        k = (i['kind'], i['msg'])
        if k not in seen:
            seen.add(k); uniq.append(i)
    issues = uniq
    # 同一科判的序号问题只留一条（「2 之后接 4」比「序号不连续」具体）
    specific = {re.search(r'「([^」]+)」', i['msg']).group(1) for i in issues if i['kind'] == '序号' and '之后接' in i['msg']}
    issues = [i for i in issues if not (i['kind'] == '序号' and '底下序号不连续' in i['msg']
                                        and re.search(r'「([^」]+)」', i['msg']).group(1) in specific)]
    # 同一类低级提示太多，就合成一条
    xs = [i for i in issues if '末尾多了标点' in i['msg']]
    if len(xs) > 5:
        issues = [i for i in issues if '末尾多了标点' not in i['msg']]
        issues.append(dict(level='低', kind='编号写法', where=xs[0]['where'], msg=f'共 {len(xs)} 处讲记标题末尾带句号等标点（可能是本书体例）。例：' + xs[0]['msg']))
    for kind in ('讲记标题无编号', '讲记标题格式'):
        xs = [i for i in issues if i['kind'] == kind]
        if len(xs) > 5:
            issues = [i for i in issues if i['kind'] != kind]
            issues.append(dict(level='低', kind=kind, where=xs[0]['where'], msg=f'共 {len(xs)} 处' + ('，讲记这一级标题不带编号（可能是本书体例）' if kind == '讲记标题无编号' else '，讲记标题用的是正文字体（可能是本书体例）') + '。例：' + xs[0]['msg']))
    key = lambda x: (ORDER[x['level']], x['kind'])
    main_ = sorted([i for i in issues if not jiangji_only(i)], key=key)
    remind = sorted([i for i in issues if jiangji_only(i)], key=key)
    return dict(stats=stats, main=main_, remind=remind, root=root, doc=kdoc)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    r = run_check(args[0], args[1] if len(args) > 1 else None)
    print(json.dumps(r['stats'], ensure_ascii=False))
    for i in r['main']:
        print(f"[{i['level']}][{i['kind']}] {i['where']}：{i['msg']}")
    if r['remind']:
        print(f'—— 提醒：讲记本身另有 {len(r["remind"])} 处可能要看（不标在科判上）——')
        for i in r['remind']:
            print(f"  · {i['where']}：{i['msg']}")
    if '--tree' in sys.argv:
        for n, d in walk(r['root']):
            print('  ' * d + n.raw, f'({len(n.text)}格正文)' if n.text else '')


if __name__ == '__main__':
    main()
