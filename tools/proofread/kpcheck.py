"""科判校对原型：不用 AI，纯规则比对。
用法: python kpcheck.py 科判.docx [讲记.docx]
"""
import sys, re, difflib, json
import docx
from docx.oxml.ns import qn

CN = '零一二三四五六七八九'
FW = str.maketrans('０１２３４５６７８９', '0123456789')
CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
VARIANTS = [set(x) for x in ['嗔瞋', '华花', '毘毗', '著着', '于於', '叹歎', '回迴', '惟唯', '修脩', '游遊', '阇闍']]


def cn2int(s):
    s = s.translate(FW)
    if s.isdigit():
        return int(s)
    n = cur = 0
    for ch in s:
        if ch == '十':
            n += (cur or 1) * 10; cur = 0
        elif ch in CN:
            cur = CN.index(ch)
        else:
            return None
    return n + cur


NUM = '一二三四五六七八九十'
LABEL_RE = re.compile(
    r'^(?:(?P<a>[一二三四五六七八九十]+)、|[（(](?P<b>[一二三四五六七八九十]+)[）)]|(?P<c>[0-9０-９]+)、|[（(](?P<d>[0-9０-９]+)[）)]|(?P<e>[①-⑳]))')
TYPES = {'a': '一、', 'b': '（一）', 'c': '1、', 'd': '（1）', 'e': '①'}


def strip_marks(s):
    s = re.sub(r'【[上下]册】', '', s)
    return s.strip().replace('　', ' ').strip()


def parse_label(raw):
    """'（八）愿差别分十六（表6）' -> dict"""
    s = strip_marks(raw)
    refs = re.findall(r'[（(]表(\d+(?:-\d+)?)[）)]', s)
    s = re.sub(r'[（(]表\d+(?:-\d+)?[）)]', '', s).strip()
    m = LABEL_RE.match(s)
    typ = num = None
    width = None
    if m:
        g = m.lastgroup
        typ = TYPES[g]
        tok = m.group(g)
        num = CIRC.index(tok) + 1 if g == 'e' else cn2int(tok)
        if g in 'cd':
            width = '全角' if tok[0] in '０１２３４５６７８９' else '半角'
        lab = m.group(0)
        if ('(' in lab or ')' in lab) and ('（' in lab or '）' in lab):
            bad = '括号全半角混用'
        else:
            bad = None
        rest = s[m.end():]
    else:
        rest = s; bad = None
    div = None
    md = re.search(r'分([一二三四五六七八九十]+)$', rest)
    if md:
        div = cn2int(md.group(1)); rest = rest[:md.start()]
    return dict(raw=raw.strip(), type=typ, num=num, width=width, name=rest.strip(), div=div, refs=refs, bad=bad)


SPLIT_RE = re.compile(r'(分[一二三四五六七八九十]+)(?=[一二三四五六七八九十]+、|（[一二三四五六七八九十]+）|[0-9０-９]+、|[①-⑳])')


def split_chain(text):
    return [x for x in SPLIT_RE.sub(r'\1\n', text).split('\n') if x.strip()]


def is_label(text):
    s = strip_marks(text)
    if not s or s.startswith('【') or s in ('科判', '正文'):
        return False
    return bool(LABEL_RE.match(s)) or bool(re.search(r'分[一二三四五六七八九十]+', s))


# ---------------- 科判 docx ----------------

def read_cells(tbl):
    cells, open_ = [], {}
    for ri, row in enumerate(tbl.tr_lst):
        c = 0
        for tc in row.tc_lst:
            pr = tc.tcPr
            sp = pr.find(qn('w:gridSpan')) if pr is not None else None
            sp = int(sp.get(qn('w:val'))) if sp is not None else 1
            vm = pr.find(qn('w:vMerge')) if pr is not None else None
            txt = ''.join(x.text or '' for x in tc.iter(qn('w:t'))).strip()
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


def table_titles(doc):
    return [p.text.strip() for p in doc.paragraphs if re.match(r'^表[\d-]+：', p.text.strip())]


def build_kepan(path, issues):
    doc = docx.Document(path)
    titles = table_titles(doc)
    root = Node(dict(raw='（全书）', type=None, num=None, width=None, name='（全书）', div=None, refs=[]), '')
    for ti, tbl in enumerate(doc.tables):
        tname = re.match(r'^(表[\d-]+)', titles[ti]).group(1) if ti < len(titles) else f'第{ti+1}个表格'
        cells = read_cells(tbl._tbl)
        width = max(c['c1'] for c in cells)
        labels = [c for c in cells if is_label(c['text'])]
        texts = [c for c in cells if c['text'] and not is_label(c['text']) and c['c1'] == width
                 and c['text'] not in ('正文',)]
        # build chains
        for c in labels:
            parts = split_chain(c['text'])
            chain = [Node(parse_label(p), tname, c['tc']) for p in parts]
            for a, b in zip(chain, chain[1:]):
                a.children.append(b); b.parent = a
            c['head'], c['tail'] = chain[0], chain[-1]
        for c in labels:
            cands = [p for p in labels if p['c1'] <= c['c0'] and p['r0'] <= c['r0'] and p['r1'] >= c['r1'] and p is not c]
            if cands:
                par = max(cands, key=lambda p: p['c1'])
                par['tail'].children.append(c['head']); c['head'].parent = par['tail']
                if par['c1'] != c['c0'] and not any(x['c0'] < c['c0'] and x['c1'] > par['c1'] - 0 and x['r0'] <= c['r0'] <= x['r1'] and x['text'] for x in cells if x is not par and x is not c):
                    pass
            c['nested'] = bool(cands)
        for c in texts:
            cands = [p for p in labels if p['c1'] <= c['c0'] and p['r0'] <= c['r0'] and p['r1'] >= c['r1']]
            if not cands:
                if not c['text'].startswith('普贤行愿品讲记') and c['text'] != '科判':
                    issues.append(dict(level='中', kind='版面', where=tname, msg=f'正文找不到对应科判：{c["text"][:20]}…'))
                continue
            par = max(cands, key=lambda p: p['c1'])
            par['tail'].text.append(c['text'])
        tops = [c['head'] for c in labels if not c['nested']]
        for t in tops:
            merge(root, t, issues)
    return root, doc


def merge(parent, node, issues):
    for ex in parent.children:
        if ex.key() == node.key():
            if ex.name != node.name:
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
    for n, _ in walk(root):
        ks = n.children
        where = '、'.join(dict.fromkeys(n.where)) if n.where[0] else ''
        if n.div is not None and len(ks) != n.div:
            issues.append(dict(level='高', kind='分数', where=where,
                               msg=f'「{n.raw}」写分{n.div}，实际有 {len(ks)} 个子科判：' + '、'.join(k.raw for k in ks)))
        if n.div is None and len(ks) > 1 and n.parent is not None:
            issues.append(dict(level='中', kind='分数', where=where, msg=f'「{n.raw}」底下有 {len(ks)} 个子科判，但没写「分{len(ks)}」'))
        typs = {k.type for k in ks if k.type}
        if len(typs) > 1:
            issues.append(dict(level='高', kind='层级字', where=where, msg=f'「{n.raw}」底下同级编号样式不一：' + '、'.join(k.raw for k in ks)))
        nums = [k.num for k in ks if k.type]
        if nums and nums != list(range(1, len(nums) + 1)):
            issues.append(dict(level='高', kind='序号', where=where, msg=f'「{n.raw}」底下序号不连续：{nums}'))
        widths = {k.width for k in ks if k.width}
        if len(widths) > 1:
            fw = [k.raw for k in ks if k.width == '全角']; hw = [k.raw for k in ks if k.width == '半角']
            issues.append(dict(level='高', kind='编号写法', where=where,
                               msg=f'「{n.raw}」底下全角半角数字混用：全角 {"、".join(x[:6] for x in fw)}；半角 {"、".join(x[:6] for x in hw)}'))
        for r in n.refs:
            if f'表{r}' not in tables_present:
                issues.append(dict(level='高', kind='跨表引用', where=where, msg=f'「{n.raw}」引用（表{r}），但文档里没有表{r}'))
            elif f'表{r}' not in n.where:
                issues.append(dict(level='中', kind='跨表引用', where=where, msg=f'「{n.raw}」引用（表{r}），但表{r}里没有这个科判'))


# ---------------- 讲记 docx ----------------

HEAD_FONT = '汉仪粗宋简'
SUTRA_FONTS = ('黑体',)


def first_font(p):
    for r in p.runs:
        if r.text.strip():
            f = r.font.name
            if f is None:
                rpr = r._r.rPr
                if rpr is not None and rpr.rFonts is not None:
                    f = rpr.rFonts.get(qn('w:eastAsia'))
            return f
    return None


def para_font(p):
    """多数字符的字体"""
    cnt = {}
    for r in p.runs:
        f = r.font.name
        if f is None:
            rpr = r._r.rPr
            if rpr is not None and rpr.rFonts is not None:
                f = rpr.rFonts.get(qn('w:eastAsia'))
        cnt[f] = cnt.get(f, 0) + len(r.text.strip())
    return max(cnt, key=cnt.get) if cnt else None


ITEM_RE = re.compile(r'(?<![0-9０-９一二三四五六七八九十])(?=(?:[一二三四五六七八九十]+、|[（(][一二三四五六七八九十0-9０-９]+[）)]|[0-9０-９]+、|[①-⑳]))')


def split_items(s):
    return [x.strip().replace('　', '') for x in ITEM_RE.split(s.strip()) if x.strip()]


VERSE_RE = re.compile(r'^(?:[（(][0-9０-９]+[）)])?(?:[^，。；！？\s]{7}[，。；！？]){1,4}$')


def read_jiangji(path):
    doc = docx.Document(path)
    ps = doc.paragraphs
    # 讲记正文从第二个「普贤行愿品讲记」大标题开始；之前是经文全文
    starts = [i for i, p in enumerate(ps) if p.text.strip().replace(' ', '') == '普贤行愿品讲记']
    body0 = starts[-1] if starts else 0
    front = [p.text.strip() for p in ps[:body0] if p.text.strip()]
    heads, cur = [], None
    for i, p in enumerate(ps[body0:], body0):
        t = p.text.strip()
        if not t:
            continue
        if t.replace(' ', '') in ('思考题',):
            break
        f = first_font(p)
        if f == HEAD_FONT:
            m = re.match(r'^分([一二三四五六七八九十]+)[：:](.*)$', t)
            if m and cur:
                cur['divline'] = dict(n=cn2int(m.group(1)), items=split_items(m.group(2)), para=i)
                continue
            info = parse_label(t)
            cur = dict(info=info, para=i, text=t, sutra=[], divline=None)
            heads.append(cur)
        elif cur is not None and para_font(p) in SUTRA_FONTS + ('华文楷体',):
            if t.startswith('【') or VERSE_RE.match(re.sub(r'\s', '', t)):
                nt = norm_text(t)
                seen = ''.join(norm_text(x) for x in cur['sutra'])
                if nt and nt not in seen:
                    cur['sutra'].append(t)
    return heads, front, ps


def norm_text(s):
    s = re.sub(r'【[上下]册】', '', s)
    return re.sub(r'[\s　，。、；：？！“”‘’「」『』（）()【】·—…,.;:?!《》〈〉]', '', s)


def name_core(s):
    s = re.sub(r'[。，；]$', '', s)
    s = re.sub(r'[（(][^）)]*[）)]$', '', s).strip()
    s = s.split('——')[0].strip()
    return s


def sim(a, b):
    return difflib.SequenceMatcher(None, a, b).ratio()


def align(root, heads, issues):
    kp = [n for n, d in walk(root) if n.parent is not None]
    ptr = 0
    matched = {}
    for h in heads:
        hi = h['info']
        best = None
        for j in range(ptr, min(len(kp), ptr + 40)):
            n = kp[j]
            s = sim(name_core(n.name), name_core(hi['name']))
            if hi['type'] and n.key() == (hi['type'], hi['num']):
                if s >= 0.5 or name_core(hi['name']).startswith(name_core(n.name)):
                    best = j; break
            elif not hi['type'] and s >= 0.8:
                best = j
                if n.type:
                    issues.append(dict(level='低', kind='讲记标题无编号', where=f'讲记第{h["para"]+1}段',
                                       msg=f'讲记标题「{h["text"]}」没有编号，科判表是「{n.raw}」'))
                break
        if best is None:
            issues.append(dict(level='高', kind='科判对照讲记', where=f'讲记第{h["para"]+1}段',
                               msg=f'讲记有标题「{h["text"]}」，科判表里找不到对应科判'))
            continue
        for n in kp[ptr:best]:
            issues.append(dict(level='中' if n.children else '高', kind='科判对照讲记', where='、'.join(dict.fromkeys(n.where)),
                               msg=f'科判表有「{n.raw}」，讲记里没有这个标题（在讲记第{h["para"]+1}段「{h["text"][:12]}」之前）'))
        n = kp[best]
        matched[id(n)] = h
        if hi.get('bad'):
            issues.append(dict(level='高', kind='编号写法', where=f'讲记第{h["para"]+1}段', msg=f'讲记标题「{h["text"]}」{hi["bad"]}'))
        if re.search(r'[。，；]$', h['text']):
            issues.append(dict(level='中', kind='编号写法', where=f'讲记第{h["para"]+1}段', msg=f'讲记标题「{h["text"]}」末尾多了标点'))
        a, b = name_core(n.name), name_core(hi['name'])
        if a != b:
            issues.append(dict(level='中', kind='科判对照讲记', where=f'{n.where[0]} / 讲记第{h["para"]+1}段',
                               msg=f'名称不同：科判表「{n.raw}」，讲记「{h["text"]}」'))
        if hi['div'] is not None and n.div is not None and hi['div'] != n.div:
            issues.append(dict(level='高', kind='科判对照讲记', where=f'{n.where[0]} / 讲记第{h["para"]+1}段',
                               msg=f'「{n.name}」科判表写分{n.div}，讲记写分{hi["div"]}'))
        dl = h['divline']
        if dl:
            if dl['n'] != len(n.children):
                issues.append(dict(level='高', kind='科判对照讲记', where=f'讲记第{dl["para"]+1}段',
                                   msg=f'讲记「{n.name}」下写「分{dl["n"]}」，科判表实有 {len(n.children)} 科'))
            if dl['n'] != len(dl['items']):
                issues.append(dict(level='高', kind='分数', where=f'讲记第{dl["para"]+1}段',
                                   msg=f'讲记写「分{dl["n"]}」，后面却列了 {len(dl["items"])} 项：{"　".join(dl["items"])}'))
            for it, ch in zip(dl['items'], n.children):
                pi = parse_label(it)
                if name_core(pi['name']) != name_core(ch.name) or (pi['type'], pi['num']) != (ch.type, ch.num):
                    issues.append(dict(level='中', kind='科判对照讲记', where=f'讲记第{dl["para"]+1}段',
                                       msg=f'讲记分科列表写「{it}」，科判表是「{ch.raw}」'))
        ptr = best + 1
    for n in kp[ptr:]:
        issues.append(dict(level='高', kind='科判对照讲记', where='、'.join(dict.fromkeys(n.where)), msg=f'科判表有「{n.raw}」，讲记里没有这个标题'))
    return matched


def diff_report(a, b, la, lb, ctx=6):
    """字级比对，返回差异列表"""
    out = []
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            continue
        x, y = a[i1:i2], b[j1:j2]
        tag = ''
        if len(x) == len(y) and all(any(cx in v and cy in v for v in VARIANTS) for cx, cy in zip(x, y)):
            tag = '（异体字）'
        before = a[max(0, i1 - ctx):i1]; after = a[i2:i2 + ctx]
        out.append(dict(tag=tag, msg=f'…{before}〔{la}：{x or "（无）"} ／ {lb}：{y or "（无）"}〕{after}…'))
    return out


def segs(a, b):
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return [(op, i1, i2, j1, j2) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != 'equal']


def is_variant(x, y):
    return len(x) == len(y) and all(any(cx in v and cy in v for v in VARIANTS) for cx, cy in zip(x, y))


def check_sutra(root, matched, front, heads, issues):
    SKIP = ('奉诏译', '编述', '普贤行愿品讲记')
    kp = ''.join(norm_text(t) for n, _ in walk(root) for t in n.text if not any(x in t for x in SKIP))
    jj = ''.join(norm_text(t) for h in heads for t in h['sutra'] if not any(x in t for x in SKIP))
    fi = next((i for i, t in enumerate(front) if '奉诏译' in t), 0)
    fr = ''.join(norm_text(t) for t in front[fi + 1:])
    if '信受奉行' in fr:
        fr = fr[:fr.rindex('信受奉行') + 4]
    k0 = kp.find('尔时普贤菩萨'); kp_b = kp[k0:] if k0 >= 0 else kp
    j0 = jj.find('尔时普贤菩萨'); jj_b = jj[j0:] if j0 >= 0 else jj
    # 三方比对：以科判表为准，分别对照讲记正文中的经文、讲记卷首经文
    def show(a, i1, i2, x):
        return f'…{a[max(0, i1-6):i1]}〔{x or "（无）"}〕{a[i2:i2+6]}…'
    other = {}
    for name, b in (('讲记正文', jj_b), ('讲记卷首经文', fr)):
        for op, i1, i2, j1, j2 in segs(kp_b, b):
            x, y = kp_b[i1:i2], b[j1:j2]
            if len(x) > 40 or len(y) > 40:
                level = '中'; kind = '经文覆盖'
                if not x:
                    msg = f'{name}有一段经文，科判表里没有：{y[:30]}…（{len(y)}字），位置在 {show(kp_b, i1, i1, "")}'
                elif not y:
                    msg = f'科判表有一段经文，{name}里没有：{x[:30]}…（{len(x)}字）'
                else:
                    msg = f'科判表与{name}有一大段不同：科判表 {x[:20]}… ／ {name} {y[:20]}…'
            else:
                level = '低' if is_variant(x, y) else '中'
                kind = '经文异体字' if is_variant(x, y) else '经文用字'
                msg = f'科判表 {show(kp_b, i1, i2, x)} ／ {name}作〔{y or "（无）"}〕'
            other.setdefault((i1, i2, x), []).append((name, y, level, kind, msg))
    for (i1, i2, x), lst in sorted(other.items()):
        names = {n for n, *_ in lst}
        if len(names) == 2 and lst[0][1] == lst[1][1]:
            n, y, level, kind, msg = lst[0]
            level = '低' if level == '低' else '高'
            issues.append(dict(level=level, kind=kind, where='全经', msg=msg.replace('讲记正文作', '讲记正文与卷首经文都作')))
        else:
            for n, y, level, kind, msg in lst:
                issues.append(dict(level=level, kind=kind, where='全经', msg=msg))
    # 逐科：只报「这一科的经文在讲记里挂在别的标题下」
    for n, _ in walk(root):
        h = matched.get(id(n))
        if not h or not n.text or not h['sutra']:
            continue
        a = ''.join(norm_text(t) for t in n.text if not any(x in t for x in SKIP))
        b = ''.join(norm_text(t) for t in h['sutra'] if not any(x in t for x in SKIP))
        if not a or not b or a == b:
            continue
        for op, i1, i2, j1, j2 in segs(a, b):
            x, y = a[i1:i2], b[j1:j2]
            if max(len(x), len(y)) >= 8:
                issues.append(dict(level='中', kind='经文归属', where=f'{n.where[-1]}「{n.raw}」/ 讲记第{h["para"]+1}段',
                                   msg=(f'科判表这一科有「{x[:16]}…」，讲记在这个标题下没有' if x else '') +
                                       ('；' if x and y else '') +
                                       (f'讲记在这个标题下有「{y[:16]}…」，科判表这一科没有' if y else '')))


def main():
    issues = []
    root, kdoc = build_kepan(sys.argv[1], issues)
    tabs = {re.match(r'^(表[\d-]+)', t).group(1) for t in table_titles(kdoc)}
    check_structure(root, issues, tabs)
    nk = sum(1 for _ in walk(root)) - 1
    stats = dict(科判数=nk)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) > 1:
        heads, front, _ = read_jiangji(args[1])
        stats['讲记标题数'] = len(heads)
        matched = align(root, heads, issues)
        stats['对上的标题'] = len(matched)
        check_sutra(root, matched, front, heads, issues)
    print(json.dumps(stats, ensure_ascii=False))
    order = {'高': 0, '中': 1, '低': 2}
    for i in sorted(issues, key=lambda x: (order[x['level']], x['kind'])):
        print(f"[{i['level']}][{i['kind']}] {i['where']}：{i['msg']}")
    if '--tree' in sys.argv:
        for n, d in walk(root):
            print('  ' * d + n.raw, f'({len(n.text)}格正文)' if n.text else '')


if __name__ == '__main__':
    main()
