"""简体版、繁体版科判对照：繁体转成简体后应当和简体版一字不差。
用法: python fjcheck.py 简体.docx 繁体.docx
"""
import sys, os, difflib, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docx
import opencc
from kpcheck import read_cells, table_titles, wtext
from docx.oxml.ns import qn

T2S = opencc.OpenCC('t2s')
# 转换器常见的「一繁对多简」或习惯写法差异，不算错
SAME = [set(x) for x in ['于於', '著着', '么麽', '里裏裡', '台臺颱檯', '后後', '面麵', '发髮發', '干乾幹', '只隻', '历曆歷', '准準', '云雲', '余餘', '谷穀', '系係繫', '征徵', '冲衝', '游遊', '回迴', '才纔', '凶兇', '咸鹹', '舍捨', '尽儘盡', '烟煙', '庄莊', '恶噁', '获穫', '御禦', '借藉', '仆僕', '吁籲', '缘緣', '熏薰']]


def same_char(a, b):
    return a == b or any(a in s and b in s for s in SAME)


def mark(a, b):
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    out = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            continue
        x, y = a[i1:i2], b[j1:j2]
        if len(x) == len(y) and all(same_char(p, q) for p, q in zip(x, y)):
            continue
        out.append((i1, x, y))
    return out


def paras(doc):
    return [wtext(p).strip() for p in doc.element.body.iterchildren(qn('w:p'))]


def compare(js, jf):
    """js、jf：简体版、繁体版 Document。返回 [(级别, 类别, 说明, (表序号, 行, 列) 或 None)]"""
    if isinstance(js, str):
        js = docx.Document(js)
    if isinstance(jf, str):
        jf = docx.Document(jf)
    issues = []
    leftover = []   # 简体版里没转成简体的字
    ts, tf = js.tables, jf.tables
    tis, tif = table_titles(js), table_titles(jf)
    if len(ts) != len(tf):
        issues.append(('高', '表格数', f'简体版 {len(ts)} 张表，繁体版 {len(tf)} 张表', None))
    for k, (a, b) in enumerate(zip(ts, tf)):
        name = ('表' + tis[k]['id']) if k < len(tis) and tis[k] else f'第{k+1}个表格'
        ca, cb = read_cells(a._tbl), read_cells(b._tbl)
        ga = {(c['r0'], c['c0']): c for c in ca}
        gb = {(c['r0'], c['c0']): c for c in cb}
        if set(ga) != set(gb):
            only_a = sorted(set(ga) - set(gb))[:3]; only_b = sorted(set(gb) - set(ga))[:3]
            issues.append(('高', '表格结构', f'{name}：两版的格子排法不同（简体版多出 {only_a}，繁体版多出 {only_b}，行,列从 0 数）', (k, 0, 0)))
        for pos in sorted(set(ga) & set(gb)):
            x, y = ga[pos], gb[pos]
            if (x['r1'], x['c1']) != (y['r1'], y['c1']):
                issues.append(('中', '表格结构', f'{name} 第{pos[0]+1}行：「{x["text"][:12]}」这一格两版合并的范围不同', (k,) + pos))
            s, f = x['text'], T2S.convert(y['text'])
            for i1, p, q in mark(s, f):
                ctx = s[max(0, i1 - 8):i1] + '〔' + (p or '　') + '〕' + s[i1 + len(p):i1 + len(p) + 8]
                if p and T2S.convert(p) == q:
                    leftover.append((name, pos, p, k))
                    continue
                issues.append(('高' if len(p) + len(q) > 2 or not (p and q) else '中', '繁简不一',
                               f'{name} 第{pos[0]+1}行：简体版 …{ctx}…，繁体版转简体后作〔{q or "（无）"}〕（繁体原文：{y["text"][max(0, i1-4):i1+len(q)+4]}）', (k,) + pos))
    if leftover:
        by = {}
        for name, pos, ch, k in leftover:
            by.setdefault((name, pos, k), []).append(ch)
        for (name, pos, k), chs in by.items():
            issues.append(('低', '简体版留有繁体字', f'{name} 第{pos[0]+1}行：简体版里有「{"".join(dict.fromkeys(chs))}」，繁体版对应的地方转成简体是另一写法（咒语、译音等若是有意保留，可以不改）', (k,) + pos))
    # 表格外的标题段落
    pa, pb = [p for p in paras(js) if p], [p for p in paras(jf) if p]
    for i, (s, f0) in enumerate(zip(pa, pb)):
        f = T2S.convert(f0)
        for i1, p, q in mark(s, f):
            issues.append(('中', '繁简不一', f'正文第{i+1}段：简体版「{s[:30]}」…〔{p or "　"}〕，繁体版作〔{q or "（无）"}〕', None))
    order = {'高': 0, '中': 1, '低': 2}
    return sorted(issues, key=lambda x: order[x[0]])


def main():
    issues = compare(sys.argv[1], sys.argv[2])
    print(f'{{"问题": {len(issues)}}}')
    for lv, kind, msg, _ in issues:
        print(f'[{lv}][{kind}] {msg}')


if __name__ == '__main__':
    main()
