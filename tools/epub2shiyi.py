#!/usr/bin/env python3
"""把讲记 / 释论的 epub 按科判切开，挂到科判树上，生成「释义」数据和对照报告。

用法:
    python3 tools/epub2shiyi.py 善说海.epub data/rxl.json -o out/rxl.shiyi.json [--report out/rxl.shiyi-report.html]

思路：
  * epub 是打包的网页，每段 <p> 都带样式名（InDesign 导出时的段落样式）。
    程序按「哪种样式里的段落大多写成『甲一、』『乙二（……）分N』」自动认出科判标题样式，
    再按样式名里的「颂词」「脚注」「品名」认出颂词、脚注、品名，其余是释文。不依赖某一本书的样式名。
  * 书里的科判标题依次和科判树（tools/pdf2kepan.py 的输出）按「层级字+序号」对齐（序列比对），
    再比较名称；对不齐的地方列进报告。
  * 两个标题之间的所有段落就是前一个科判的释义。颂词段再和科判表里的颂词逐字比对，
    能对上的标出是该科第几颂（stanza），方便界面高亮；对不上的分成「疑似错字」和「用字不同」列进报告。

只用标准库。
"""
import argparse
import difflib
import html
import json
import posixpath
import re
import sys
import zipfile
from collections import Counter, defaultdict
from urllib.parse import unquote
from xml.etree import ElementTree as ET

LEVELS = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥"
NUMS = "一二三四五六七八九十"
LABEL_RE = re.compile(rf"^([{LEVELS}])([{NUMS}]+)\s*([、（(])")
PARA_RE = re.compile(r"<(p|h[1-6])\b([^>]*)>(.*?)</\1>", re.S)
CLASS_RE = re.compile(r'class="([^"]*)"')

# 常见通用字 / 异体字：颂词里这些字互换只算「用字不同」，不算错字。
VARIANT_PAIRS = [
    "须需", "着著", "伏匐", "战颤", "于於", "惟唯", "分份", "象像", "迹跡", "藉借",
    "纔才", "徧遍", "鬪斗", "凈净", "諍诤", "争诤", "叹歎", "欲慾", "布佈", "云雲",
    "采採", "併并", "裏里", "沈沉", "游遊", "咒呪", "睹覩", "晒曬", "暱昵", "么麼",
]
VARIANTS = set()
for a, b in VARIANT_PAIRS:
    VARIANTS.add((a, b))
    VARIANTS.add((b, a))

CN = {c: i + 1 for i, c in enumerate(NUMS)}


def cn2int(s):
    if s == "十":
        return 10
    if s.startswith("十"):
        return 10 + CN[s[1]]
    if s.endswith("十"):
        return CN[s[0]] * 10
    if "十" in s:
        a, b = s.split("十")
        return CN[a] * 10 + CN[b]
    return CN[s]


def han(s):
    """只留汉字，用于逐字比对。"""
    return re.sub(r"[^㐀-鿿\U00020000-\U0002ffff]", "", s or "")


def norm_name(s):
    s = re.split(rf"分[{NUMS}]+[：:]", s or "")[0]
    s = re.sub(rf"分[{NUMS}]+$", "", re.sub(r"[\s：:。]+$", "", s))
    return re.sub(r"[\s，、。：:；;！!？?“”‘’「」『』\[\]【】（）()]", "", s or "")


# ---------------------------------------------------------------- epub 读取

SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def read_epub(path):
    """按 spine 顺序返回 [(样式, 文字, 文件)]。"""
    z = zipfile.ZipFile(path)
    cont = ET.fromstring(z.read("META-INF/container.xml"))
    opf_path = next(e.get("full-path") for e in cont.iter() if e.tag.endswith("rootfile"))
    opf_dir = posixpath.dirname(opf_path)
    opf = ET.fromstring(z.read(opf_path))
    manifest, spine, meta = {}, [], {}
    for e in opf.iter():
        tag = e.tag.split("}")[-1]
        if tag == "item":
            manifest[e.get("id")] = unquote(e.get("href"))
        elif tag == "itemref":
            spine.append(e.get("idref"))
        elif tag in ("title", "creator", "publisher", "date", "language") and e.text:
            meta.setdefault(tag, e.text.strip())
    paras = []
    for sid in spine:
        href = manifest.get(sid)
        if not href:
            continue
        name = posixpath.normpath(posixpath.join(opf_dir, href))
        try:
            s = z.read(name).decode("utf-8")
        except KeyError:
            continue
        body = s[s.find("<body"):] if "<body" in s else s
        for m in PARA_RE.finditer(body):
            cm = CLASS_RE.search(m.group(2))
            cls = cm.group(1).split()[0] if cm else m.group(1)
            inner = re.sub(r"<br\s*/?>", "\n", m.group(3))
            # 脚注引用号改成上标数字，免得和正文连成「（就会发现）5它」
            inner = re.sub(r"<a\b[^>]*(?:noteref|_idFootnoteLink)[^>]*>\s*(\d+)\s*</a>",
                           lambda a: a.group(1).translate(SUP), inner)
            text = html.unescape(re.sub(r"<[^>]+>", "", inner))
            text = re.sub(r"[ \t　]+", " ", text).strip()
            if text:
                paras.append({"cls": cls, "text": text, "file": href})
    return paras, meta


def classify(paras):
    """认出科判标题样式，并给每段标上类型。"""
    by = defaultdict(list)
    for p in paras:
        by[p["cls"]].append(p["text"])
    best, best_n = None, 0
    for cls, texts in by.items():
        n = sum(1 for t in texts if LABEL_RE.match(t))
        if n >= 5 and n / len(texts) >= 0.8 and n > best_n:
            best, best_n = cls, n
    if not best:
        raise SystemExit("没认出科判标题：epub 里没有一种段落样式大多写成「甲一、」「乙二（……）分N」")
    for p in paras:
        c = p["cls"]
        if c == best:
            p["type"] = "heading"
        elif "脚注" in c or "footnote" in c.lower():
            p["type"] = "footnote"
        elif "品名" in c:
            p["type"] = "chapter"
        elif "品终" in c or "品释终" in c:
            p["type"] = "chapterEnd"
        elif "前后缀" in c:
            p["type"] = "gatha"  # 释论作者在品首、品末加的偈颂，不属于本论颂词
        elif "颂" in c or "偈" in c or "verse" in c.lower():
            p["type"] = "verse"
        else:
            p["type"] = "text"
    return best


def parse_heading(t):
    t = re.sub(r"[：:。\s]+$", "", t)
    m = LABEL_RE.match(t)
    if not m:
        return None, None, t, t
    level, num, sep = m.group(1), cn2int(m.group(2)), m.group(3)
    rest = t[m.end():]
    if sep == "、":
        name = rest
    else:
        depth, i = 1, 0
        for i, ch in enumerate(rest):
            if ch in "（(":
                depth += 1
            elif ch in "）)":
                depth -= 1
                if depth == 0:
                    break
        name = rest[:i]
    return level, num, name, t


# ---------------------------------------------------------------- 对齐

def flatten(tree):
    out = []

    def walk(n):
        out.append(n)
        for c in n.get("children", []):
            walk(c)
    for n in tree:
        walk(n)
    return out


def align(nodes, heads):
    """按（层级字, 序号）做序列比对；返回 [(node_idx|None, head_idx|None, 状态)]。"""
    A = [(n.get("level"), n.get("num")) for n in nodes]
    B = [(h["level"], h["num"]) for h in heads]
    sm = difflib.SequenceMatcher(None, A, B, autojunk=False)
    pairs = []
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == "equal":
            pairs += [(i, j, "equal") for i, j in zip(range(a1, a2), range(b1, b2))]
            continue
        # 不等的块里再按名称相似度配对（例如没有层级字的总科）
        used = set()
        for i in range(a1, a2):
            best, score = None, 0.0
            for j in range(b1, b2):
                if j in used:
                    continue
                r = difflib.SequenceMatcher(None, norm_name(nodes[i]["name"]), norm_name(heads[j]["name"])).ratio()
                if r > score:
                    best, score = j, r
            if best is not None and score >= 0.6:
                used.add(best)
                pairs.append((i, best, "name"))
            else:
                pairs.append((i, None, "missing"))
        pairs += [(None, j, "extra") for j in range(b1, b2) if j not in used]
    return pairs


# ---------------------------------------------------------------- 颂词比对

def stanza_index(node):
    """科判表里该科的颂（句）列表。"""
    out = []
    for v in node.get("verses", []):
        if v.get("kind") != "verse":
            continue
        out += v.get("stanzas") or [v["text"]]
    return out


def diff_kind(a, b):
    if len(a) == len(b) and a and all((x, y) in VARIANTS for x, y in zip(a, b)):
        return "用字不同"
    return "疑似错字"


def compare_verses(node, seg):
    """返回 (颂词差异列表, 每个颂词段对应的 stanza 序号)。"""
    st = stanza_index(node)
    pv = "".join(han(s) for s in st)
    ev_parts = [(k, han(p["text"])) for k, p in enumerate(seg) if p["type"] == "verse"]
    ev = "".join(t for _, t in ev_parts)
    # 段落 → stanza：按在全科颂词串里的位置
    marks = {}
    if st:
        starts, pos = [], 0
        for s in st:
            starts.append(pos)
            pos += len(han(s))
        sm = difflib.SequenceMatcher(None, ev, pv, autojunk=False)
        epos = 0
        for k, t in ev_parts:
            if not t:
                continue
            mapped = None
            for blk in sm.get_matching_blocks():
                if blk.a <= epos < blk.a + blk.size:
                    mapped = blk.b + (epos - blk.a)
                    break
            if mapped is not None:
                idx = max(i for i, s0 in enumerate(starts) if s0 <= mapped)
                marks[k] = idx
            epos += len(t)
    diffs = []
    if pv and ev and pv != ev:
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, pv, ev, autojunk=False).get_opcodes():
            if op == "equal":
                continue
            a, b = pv[i1:i2], ev[j1:j2]
            kind = diff_kind(a, b) if op == "replace" else ("科判多出" if op == "delete" else "讲记多出")
            diffs.append({
                "kind": kind, "kepan": a, "jiangji": b,
                "ctxKepan": pv[max(0, i1 - 6):i2 + 6], "ctxJiangji": ev[max(0, j1 - 6):j2 + 6],
            })
    return diffs, marks, bool(pv), bool(ev)


# ---------------------------------------------------------------- 主流程

def convert(epub_path, tree_json):
    paras, epub_meta = read_epub(epub_path)
    head_cls = classify(paras)
    heads = []
    for k, p in enumerate(paras):
        if p["type"] == "heading":
            lv, num, name, raw = parse_heading(p["text"])
            heads.append({"idx": k, "level": lv, "num": num, "name": name, "raw": p["text"]})
    nodes = flatten(tree_json["tree"])
    pairs = align(nodes, heads)

    # 释义正文的结束位置：最后一个标题之后，到第一个「品名/目录类」以外的长段落为止不好判断，
    # 所以取最后一个标题之后、直到下一个科判样式区（附录科判表等）之前的段落。
    body_end = len(paras)
    last = heads[-1]["idx"]
    for k in range(last + 1, len(paras)):
        c = paras[k]["cls"]
        if "科判" in c and paras[k]["type"] != "heading":
            body_end = k
            break

    head_pos = [h["idx"] for h in heads]
    gatha_all = "".join(han(p["text"]) for p in paras if p["type"] == "gatha")
    # 品名和品首偈出现在上一科的末尾、下一科标题之前：把它们挪到下一科，作为该科的「引言」
    lead_start, lead_start_of_next = {}, {}
    for j in range(1, len(heads)):
        a, b = head_pos[j - 1] + 1, head_pos[j]
        for k in range(a, b):
            if paras[k]["type"] == "chapter":
                lead_start[j] = k
                lead_start_of_next[j - 1] = k
                break
    sections, report = {}, {"nameDiffs": [], "missing": [], "extra": [], "verseDiffs": [],
                            "verseOnlyKepan": [], "verseOnlyJiangji": []}
    stats = Counter()
    for i, j, st in pairs:
        if i is None:
            report["extra"].append({"heading": heads[j]["raw"]})
            continue
        n = nodes[i]
        if j is None:
            if n.get("level"):
                report["missing"].append({"id": n["id"], "raw": n["raw"]})
            continue
        h = heads[j]
        if norm_name(n["name"]) != norm_name(h["name"]):
            report["nameDiffs"].append({"id": n["id"], "kepan": n["raw"], "jiangji": h["raw"]})
        nxt = head_pos[j + 1] if j + 1 < len(head_pos) else body_end
        nxt = lead_start_of_next.get(j, nxt)
        lead = paras[lead_start[j]:h["idx"]] if j in lead_start else []
        seg = paras[h["idx"] + 1:nxt]
        diffs, marks, has_p, has_e = compare_verses(n, seg)
        if diffs:
            report["verseDiffs"].append({"id": n["id"], "raw": n["raw"], "diffs": diffs})
        elif has_p and not has_e:
            pv = "".join(han(x) for x in stanza_index(n))
            where = "附偈" if pv and pv in gatha_all else "无"
            report["verseOnlyKepan"].append({"id": n["id"], "raw": n["raw"], "inGatha": where == "附偈"})
        elif has_e and not has_p:
            report["verseOnlyJiangji"].append({"id": n["id"], "raw": n["raw"]})
        items = [{"type": p["type"], "text": p["text"], "lead": True} for p in lead]
        for k, p in enumerate(seg):
            it = {"type": p["type"], "text": p["text"]}
            if k in marks:
                it["stanza"] = marks[k]
            items.append(it)
        sections[n["id"]] = {"heading": h["raw"], "items": items}
        stats["sections"] += 1
        stats["chars"] += sum(len(p["text"]) for p in lead + seg if p["type"] in ("text", "verse", "gatha"))
        stats[st] += 1

    # 第一个标题之前的段落（序、传记、品首颂等）单独放进 front
    front = [{"type": p["type"], "text": p["text"]} for p in paras[:heads[0]["idx"]]
             if p["type"] in ("text", "verse", "chapter")]
    out = {
        "bookId": tree_json.get("id"),
        "source": {"file": epub_path.split("/")[-1], "epub": epub_meta, "headingStyle": head_cls},
        "stats": {
            "nodes": len(nodes), "headings": len(heads), "sections": stats["sections"],
            "alignedByNumber": stats["equal"], "alignedByName": stats["name"], "chars": stats["chars"],
            "nameDiffs": len(report["nameDiffs"]), "missing": len(report["missing"]),
            "extra": len(report["extra"]), "verseDiffNodes": len(report["verseDiffs"]),
        },
        "report": report,
        "front": front,
        "sections": sections,
    }
    return out


# ---------------------------------------------------------------- 勘误建议

def _match_key(n, nodes):
    """勘误用的定位：科判原文 + 所在表；同表同名时再加 id。"""
    t = n["src"]["table"]
    hits = [m for m in nodes if m["raw"].startswith(n["raw"]) and t in m.get("seenIn", [m["src"]["table"]])]
    fx = {"match": n["raw"], "table": t}
    if len(hits) != 1:
        fx["id"] = n["id"]
    return fx


def suggest_fixes(data, tree_json):
    """按对照结果生成勘误建议（tools/pdf2kepan.py 的勘误格式）。

    每条带 kind（疑似错字 / 用字不同 / 科名不同）、kepan、jiangji、raw，以及 fix（选「用讲记」时要套用的勘误）。
    颂词多出或缺少、讲记多出的标题这类没法自动改，不在这里，界面上只作提示。"""
    nodes = flatten(tree_json["tree"])
    byid = {n["id"]: n for n in nodes}
    out = []
    for v in data["report"]["verseDiffs"]:
        n = byid.get(v["id"])
        if not n:
            continue
        for d in v["diffs"]:
            if d["kind"] not in ("疑似错字", "用字不同"):
                continue
            fix = None
            for vv in n.get("verses", []):
                if vv.get("kind") != "verse":
                    continue
                text = vv["text"]
                idx = [i for i, ch in enumerate(text) if han(ch)]
                h = "".join(text[i] for i in idx)
                p = h.find(d["ctxKepan"])
                if p < 0:
                    continue
                for off in [o for o in range(len(d["ctxKepan"])) if d["ctxKepan"].startswith(d["kepan"], o)]:
                    k = p + off
                    for w in range(1, 8):
                        a, b = max(0, k - w), min(len(idx), k + len(d["kepan"]) + w)
                        old = text[idx[a]:idx[b - 1] + 1]
                        if text.count(old) == 1:
                            rel = idx[k] - idx[a]
                            new = old[:rel] + d["jiangji"] + old[rel + len(d["kepan"]):]
                            fix = dict(_match_key(n, nodes), verse=[old, new],
                                       reason=f"颂词按讲记：{d['kepan']}→{d['jiangji']}（{d['kind']}）")
                            break
                    if fix:
                        break
                if fix:
                    break
            if fix and all(o["fix"] != fix for o in out):
                out.append({"kind": d["kind"], "raw": n["raw"], "kepan": d["ctxKepan"], "jiangji": d["ctxJiangji"],
                            "piece": [d["kepan"], d["jiangji"]], "fix": fix})
    for x in data["report"]["nameDiffs"]:
        n = byid.get(x["id"])
        if not n or not n.get("level"):
            continue
        lv, num, jn, _ = parse_heading(x["jiangji"])
        jn = re.split(rf"分[{NUMS}]+[：:]", jn)[0]
        if not jn or jn == n["name"] or n["name"] not in n["raw"]:
            continue
        fix = dict(_match_key(n, nodes), replace=[n["name"], jn], set={"name": jn},
                   reason=f"科名按讲记：{n['name']}→{jn}")
        out.append({"kind": "科名不同", "raw": n["raw"], "kepan": n["name"], "jiangji": jn,
                    "piece": [n["name"], jn], "fix": fix})
    return out


# ---------------------------------------------------------------- 报告页

def build_report(data, title):
    e = html.escape
    s = data["stats"]
    r = data["report"]
    typos, variants, extra = [], [], []
    for v in r["verseDiffs"]:
        for d in v["diffs"]:
            row = (v, d)
            (typos if d["kind"] == "疑似错字" else variants if d["kind"] == "用字不同" else extra).append(row)

    def hl(ctx, piece):
        if piece and piece in ctx:
            i = ctx.index(piece)
            return e(ctx[:i]) + "<mark>" + e(piece) + "</mark>" + e(ctx[i + len(piece):])
        return e(ctx)

    def verse_rows(rows):
        if not rows:
            return "<p class=none>没有</p>"
        out = ["<table><tr><th>科判</th><th>科判表</th><th>讲记</th></tr>"]
        for v, d in rows:
            out.append(f"<tr><td>{e(v['raw'])}</td><td>{hl(d['ctxKepan'], d['kepan'])}</td>"
                       f"<td>{hl(d['ctxJiangji'], d['jiangji'])}</td></tr>")
        out.append("</table>")
        return "".join(out)

    def simple(rows, a, b, ka, kb):
        if not rows:
            return "<p class=none>没有</p>"
        out = [f"<table><tr><th>{a}</th><th>{b}</th></tr>"]
        for x in rows:
            out.append(f"<tr><td>{e(x.get(ka, ''))}</td><td>{e(x.get(kb, ''))}</td></tr>")
        out.append("</table>")
        return "".join(out)

    css = """
:root{--bg:#faf8f3;--fg:#2b2620;--mut:#7a7166;--line:#e4ddd0;--card:#fff;--mark:#f6d58a;--acc:#9b2d20}
@media (prefers-color-scheme:dark){:root{--bg:#1c1a17;--fg:#ece6dc;--mut:#a39a8d;--line:#3a352e;--card:#24211d;--mark:#7a5a17;--acc:#e08a6f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.7 "Noto Serif SC","Songti SC",serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.15rem;margin:32px 0 8px;color:var(--acc)}
.sub{color:var(--mut);margin:0 0 16px}.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.nums div{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.nums b{display:block;font-size:1.4rem}
.nums span{color:var(--mut);font-size:.85rem}table{width:100%;border-collapse:collapse;background:var(--card);font-size:.95rem}
td,th{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{color:var(--mut);font-weight:normal}
mark{background:var(--mark);color:inherit;padding:0 1px}.none{color:var(--mut)}.tw{overflow-x:auto}
"""
    parts = [f"<!doctype html><html lang=zh-CN><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
             f"<title>{e(title)} 讲记对照</title><style>{css}</style></head><body><main>",
             f"<h1>{e(title)} · 讲记对照报告</h1><p class=sub>讲记：{e(data['source']['file'])}</p>",
             "<div class=nums>",
             f"<div><b>{s['sections']}/{s['nodes']}</b><span>科判挂上了释义</span></div>",
             f"<div><b>{s['chars']:,}</b><span>释义字数</span></div>",
             f"<div><b>{len(typos)}</b><span>颂词疑似错字</span></div>",
             f"<div><b>{len(variants)}</b><span>颂词用字不同</span></div>",
             f"<div><b>{s['nameDiffs']}</b><span>科名写法不同</span></div>",
             f"<div><b>{s['missing'] + s['extra']}</b><span>没对上的科判</span></div>",
             "</div>",
             "<h2>颂词疑似错字（请确认）</h2><div class=tw>", verse_rows(typos), "</div>",
             "<h2>颂词用字不同（仅供参考）</h2><div class=tw>", verse_rows(variants), "</div>",
             "<h2>颂词多出或缺少（请看一下）</h2><p class=sub>常见原因是同一颂在科判表和讲记里分到了相邻的不同科。</p><div class=tw>",
             verse_rows(extra), "</div>",
             "<h2>科判表有颂词、讲记这一科没有（请看一下）</h2>",
             "<p class=sub>标「讲记附偈」的，是释论作者在品末自造的偈颂，讲记把它放在品末，科判表把它挂在了这一科。</p><div class=tw>",
             simple([dict(x, where="讲记附偈" if x.get("inGatha") else "讲记里没找到") for x in r["verseOnlyKepan"]],
                    "科判", "说明", "raw", "where"), "</div>",
             "<h2>科名写法不同（请看一下）</h2><div class=tw>",
             simple(r["nameDiffs"], "科判表", "讲记", "kepan", "jiangji"), "</div>",
             "<h2>科判表有、讲记里没找到的科判</h2><div class=tw>",
             simple(r["missing"], "科判", "", "raw", "id"), "</div>",
             "<h2>讲记里多出的标题</h2><div class=tw>",
             simple(r["extra"], "讲记标题", "", "heading", ""), "</div>",
             "</main></body></html>"]
    return "".join(parts)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("epub")
    ap.add_argument("tree", help="tools/pdf2kepan.py 生成的科判 JSON")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--report", help="另存一页 HTML 对照报告")
    ap.add_argument("--name", help="报告里显示的讲记文件名（默认取 epub 文件名）")
    a = ap.parse_args()
    tree = json.load(open(a.tree, encoding="utf-8"))
    data = convert(a.epub, tree)
    if a.name:
        data["source"]["file"] = a.name
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    s = data["stats"]
    print(json.dumps(s, ensure_ascii=False))
    nt = sum(1 for v in data["report"]["verseDiffs"] for d in v["diffs"] if d["kind"] == "疑似错字")
    print(f"颂词疑似错字 {nt} 处；科名写法不同 {s['nameDiffs']} 处；没对上 {s['missing'] + s['extra']} 处")
    if a.report:
        title = (tree.get("meta") or {}).get("title") or tree.get("id") or ""
        with open(a.report, "w", encoding="utf-8") as f:
            f.write(build_report(data, title))


if __name__ == "__main__":
    sys.exit(main())
