#!/usr/bin/env python3
"""把 Word 导出的「颂词 + 科判」表格式 PDF 转成结构化 JSON。

用法:
    python3 tools/pdf2kepan.py 输入.pdf -o data/rxl.json [--pages 1-6] [--id rxl]

思路：PDF 里的科判是一张张嵌套表格。pdfplumber 能拿到每个单元格的矩形，
竖排的高层科判只是很窄的合并单元格。所以不靠文字顺序，而是靠几何关系：
  * 单元格 B 的左边紧贴单元格 A 的右边，且 B 的上下范围落在 A 之内 → A 是 B 的父科判；
  * 颂词单元格（不像科判标题、且延伸到表格右边缘）挂到紧贴其左边的科判上；
  * 各张分表（表1、表2-1……）再按「层级字+序号」和「（表X）」引用合并进总表。
同一格式的其他论典 PDF 可以直接复用。
"""
import argparse
import json
import re
import sys
from collections import defaultdict

import pdfplumber

LEVELS = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥"
NUMS = "一二三四五六七八九十"
CN = {c: i + 1 for i, c in enumerate(NUMS)}

LABEL_RE = re.compile(rf"^([{LEVELS}])([{NUMS}]+)([、（(])")
REF_RE = re.compile(r"[（(]\s*表\s*([\d\-]+)\s*[）)]")
REFCOUNT_RE = re.compile(r"[（(]\s*\d+\s*表\s*[）)]")
CHAPTER_RE = re.compile(r"(第[一二三四五六七八九十]+品)\s*([^（(]*)")
TITLE_RE = re.compile(r"^(?:（插表）)?表\s*([\d]+(?:-\d+)?)")
TOL = 2.0


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


def clean(s):
    return re.sub(r"\s+", "", s)


def parse_label(text):
    """'庚二（意乐殊胜）分二 第二品 忏悔罪业（表2）（2表）' → dict；不是科判返回 None。"""
    t = clean(text)
    m = LABEL_RE.match(t)
    if not m:
        return None
    level, num, sep = m.group(1), m.group(2), m.group(3)
    rest = t[m.end() - 1:]
    if sep == "、":
        rest = rest[1:]
        # 名称到「（表」或「第X品」为止
        cut = len(rest)
        for pat in (REF_RE, CHAPTER_RE):
            mm = pat.search(rest)
            if mm:
                cut = min(cut, mm.start())
        name, tail = rest[:cut], rest[cut:]
    else:
        depth, i = 0, 0
        for i, ch in enumerate(rest):
            if ch in "（(":
                depth += 1
            elif ch in "）)":
                depth -= 1
                if depth == 0:
                    break
        name, tail = rest[1:i], rest[i + 1:]
    div = None
    md = re.match(rf"分([{NUMS}]+)", tail)
    if md:
        div = cn2int(md.group(1))
        tail = tail[md.end():]
    note = None
    mn = re.search(r"[（(](注[：:].+?|详细科判见.+?)[）)]", tail)
    if mn:
        note = mn.group(1)
        tail = tail[:mn.start()] + tail[mn.end():]
    refs = REF_RE.findall(tail)
    chapter = None
    mc = CHAPTER_RE.search(REF_RE.sub("", REFCOUNT_RE.sub("", tail)))
    if mc:
        chapter = (mc.group(1) + " " + mc.group(2)).strip()
    return {
        "level": level,
        "depth": LEVELS.index(level) + 1,
        "num": cn2int(num),
        "name": name,
        "divisions": div,
        "chapter": chapter,
        "refs": ["表" + r for r in refs],
        "note": note,
    }


def split_labels(text):
    """一个竖排合并格里可能叠了好几层科判（如「丁二（安忍）分二第六品安忍戊二（修持方法）分二」），按层拆开。"""
    t = clean(text)
    cuts, depth = [0], 0
    for i, ch in enumerate(t):
        if ch in "（(":
            depth += 1
        elif ch in "）)":
            depth -= 1
        elif depth == 0 and i > 0 and LABEL_RE.match(t[i:]):
            cuts.append(i)
    cuts.append(len(t))
    return [t[a:b] for a, b in zip(cuts, cuts[1:])]


def split_stanzas(text):
    """颂词按句切，四句一偈。"""
    t = clean(text)
    sents = re.findall(r"[^，。！？；?!：:]+[，。！？；?!：:]?", t)
    out, cur = [], []
    for s in sents:
        cur.append(s)
        if len(cur) == 4:
            out.append("".join(cur))
            cur = []
    if cur:
        out.append("".join(cur))
    return out


# ---------------------------------------------------------------- 单页解析

def group_lines(chars):
    rows = []
    for c in sorted(chars, key=lambda c: (round(c["top"]), c["x0"])):
        if rows and abs(rows[-1][0]["top"] - c["top"]) < 3:
            rows[-1].append(c)
        else:
            rows.append([c])
    return rows


def parse_page(page, pno, warnings):
    tables = page.find_tables()
    cells_all = []
    tinfo = []
    for t in tables:
        x0, top, x1, bottom = t.bbox
        cells = [dict(x0=c[0], top=c[1], x1=c[2], bottom=c[3], chars=[]) for c in t.cells]
        tinfo.append(dict(bbox=t.bbox, cells=cells, title=None, page=pno))
        cells_all += [(len(tinfo) - 1, c) for c in cells]

    outside = []
    for ch in page.chars:
        cx, cy = (ch["x0"] + ch["x1"]) / 2, (ch["top"] + ch["bottom"]) / 2
        hit = None
        for ti, c in cells_all:
            if c["x0"] <= cx <= c["x1"] and c["top"] <= cy <= c["bottom"]:
                hit = c
                break
        if hit:
            hit["chars"].append(ch)
        else:
            outside.append(ch)

    header_lines = []
    for row in group_lines(outside):
        text = "".join(c["text"] for c in sorted(row, key=lambda c: c["x0"]))
        top = row[0]["top"]
        ct = clean(text)
        if not ct:
            continue
        if re.search(r"\d+/\d+$", ct):  # 页脚
            continue
        m = TITLE_RE.match(ct)
        if m:
            # 标题属于其下方最近的表格
            below = [t for t in tinfo if t["bbox"][1] >= top - 1]
            if below:
                tgt = min(below, key=lambda t: t["bbox"][1])
                tgt["title"] = text.strip()
                tgt["id"] = "表" + m.group(1)
            continue
        # 溢出单元格的文字：挂到正上方、x 重叠的最近单元格
        cx = sum((c["x0"] + c["x1"]) / 2 for c in row) / len(row)
        cand = [c for _, c in cells_all if c["x0"] <= cx <= c["x1"] and c["bottom"] <= top + 1 and top - c["bottom"] < 40]
        if cand:
            tgt = max(cand, key=lambda c: c["bottom"])
            tgt["chars"].extend(row)
            warnings.append(f"第{pno}页：文字溢出单元格，已并入上方单元格：{ct[:20]}")
        else:
            header_lines.append(ct)
            header_lines[-1] = text.strip()

    for t in tinfo:
        for c in t["cells"]:
            c["text"] = "".join(ch["text"] for ch in c["chars"])
            c["ct"] = clean(c["text"])
        if not t.get("id"):
            t["id"] = f"p{pno}"
            warnings.append(f"第{pno}页：表格没找到标题")
    return tinfo, header_lines


# ---------------------------------------------------------------- 单表 → 树

def table_to_tree(t, warnings):
    x_right = t["bbox"][2]
    cells = [c for c in t["cells"] if c["ct"] and c["ct"] not in ("科判", "颂词")]
    nodes, verses = [], []
    for c in cells:
        lab = parse_label(c["text"])
        reaches_right = abs(c["x1"] - x_right) < TOL
        if lab or not reaches_right:
            parts = split_labels(c["text"]) if lab else [c["ct"]]
            chain = []
            for part in parts:
                pl = parse_label(part)
                node = dict(pl or {"level": None, "depth": 0, "num": None, "name": part,
                                   "divisions": None, "chapter": None, "refs": [], "note": None})
                if not pl:
                    mdv = re.search(rf"分([{NUMS}]+)$", part)
                    if mdv:
                        node["divisions"] = cn2int(mdv.group(1))
                node.update(raw=part, children=[], verses=[],
                            src={"table": t["id"], "page": t["page"]})
                if chain:
                    chain[-1]["children"].append(node)
                chain.append(node)
            head = chain[0]
            head["_c"] = c
            head["_tail"] = chain[-1]
            nodes.append(head)
        else:
            verses.append(c)

    def parent_of(c):
        best = None
        for n in nodes:
            a = n["_c"]
            if a is c:
                continue
            if abs(a["x1"] - c["x0"]) < TOL and a["top"] <= c["top"] + TOL and a["bottom"] >= c["bottom"] - TOL:
                if best is None or a["x0"] > best["_c"]["x0"]:
                    best = n
        return best

    tops = []
    for n in sorted(nodes, key=lambda n: (n["_c"]["top"], n["_c"]["x0"])):
        p = parent_of(n["_c"])
        (p["_tail"]["children"] if p else tops).append(n)

    # 层级比所在列浅的科判（如表4-2把「己三、摄义」画在辛那一列）：上移到正确的祖先下
    def relevel(n, anc):
        for c in list(n["children"]):
            if c["level"] and n["level"] and c["depth"] <= n["depth"]:
                host = next((a for a in reversed(anc) if a["level"] and a["depth"] == c["depth"] - 1), None)
                if host:
                    n["children"].remove(c)
                    host["children"].append(c)
                    warnings.append(f"{t['id']}（第{t['page']}页）：「{c['raw']}」画在了「{n['raw']}」之内，按层级上移到「{host['raw']}」下")
        for c in list(n["children"]):
            relevel(c, anc + [n])
    for n in tops:
        relevel(n, [])

    # 表格底部有时把某个科判单独放在最左列（例如表8-6的「己三」），
    # 它其实是前面某层同级科判的兄弟：挂到已有同级科判的父节点下。
    first, rest = tops[:1], []
    for n in tops[1:]:
        host = None
        if n["level"]:
            for m, _ in (x for f in first for x in walk(f)):
                if any(c["level"] == n["level"] for c in m["children"]):
                    host = m
        if host:
            host["children"].append(n)
            warnings.append(f"{t['id']}（第{t['page']}页）：「{n['raw']}」在表格最左列，按层级挂到「{host['raw']}」下")
        else:
            rest.append(n)
    tops = first + rest

    for v in sorted(verses, key=lambda c: c["top"]):
        kind = "note" if re.search(r"释终$|^梵语", v["ct"]) or not re.search(r"[，,。！？?!]", v["ct"]) else "verse"
        item = {"kind": kind, "text": v["ct"], "src": {"table": t["id"], "page": t["page"]}}
        if kind == "verse":
            item["stanzas"] = split_stanzas(v["ct"])
        left = [n for n in nodes if abs(n["_c"]["x1"] - v["x0"]) < TOL
                and min(n["_c"]["bottom"], v["bottom"]) - max(n["_c"]["top"], v["top"]) > 1]
        if not left:
            # 横跨整张表的颂词（如论末回向偈）挂到表格最外层科判之后
            above = [n for n in tops if n["_c"]["top"] <= v["top"]]
            if not above:
                warnings.append(f"{t['id']}（第{t['page']}页）：颂词找不到对应科判：{v['ct'][:20]}")
                continue
            owner = max(above, key=lambda n: n["_c"]["top"])
            item["pos"] = "after"
            owner["verses"].append(item)
            warnings.append(f"{t['id']}（第{t['page']}页）：通栏颂词挂到「{owner['raw']}」末尾：{v['ct'][:12]}…")
            continue
        if len(left) > 1:
            warnings.append(f"{t['id']}（第{t['page']}页）：一格颂词跨了 {len(left)} 个科判，已挂到第一个：{v['ct'][:20]}")
        owner = min(left, key=lambda n: n["_c"]["top"])["_tail"]
        kids = [k["_c"] for k in owner["children"] if "_c" in k]
        if kids:
            item["pos"] = "after" if v["top"] >= max(k["top"] for k in kids) else "before"
        item["_y"] = v["top"]
        owner["verses"].append(item)
    return tops


# ---------------------------------------------------------------- 合并分表

def key(n):
    return (n["level"], n["num"]) if n["level"] else ("", n["name"])


def table_sort_key(tid):
    m = re.match(r"表(\d+)(?:-(\d+))?", tid)
    return (int(m.group(1)), int(m.group(2) or 0)) if m else (999, 0)


def walk(n, path=()):
    yield n, path
    for c in n["children"]:
        yield from walk(c, path + (n,))


def merge_into(dst, src, warnings):
    if dst["level"] and dst["name"] != src["name"]:
        alts = dst.setdefault("altNames", [])
        if src["name"] not in alts:
            alts.append(src["name"])
            warnings.append(f"同一科判名称不一致：「{dst['name']}」vs「{src['name']}」（{src['src']['table']}）")
    for k in ("divisions", "chapter", "note"):
        if not dst.get(k) and src.get(k):
            dst[k] = src[k]
    for r in src["refs"]:
        if r not in dst["refs"]:
            dst["refs"].append(r)
    dst.setdefault("seenIn", [dst["src"]["table"]])
    if src["src"]["table"] not in dst["seenIn"]:
        dst["seenIn"].append(src["src"]["table"])
    dst["verses"].extend(src["verses"])
    for sc in src["children"]:
        match = next((c for c in dst["children"] if key(c) == key(sc)), None)
        if match:
            merge_into(match, sc, warnings)
        else:
            dst["children"].append(sc)


def find_target(root, top, tid, warnings):
    major = tid.split("-")[0]
    cands = []
    for n, path in walk(root):
        if n is root or key(n) != key(top):
            continue
        sub_refs = {r for m, _ in walk(n) for r in m["refs"]}
        score = 0
        if n["name"] == top["name"]:
            score += 2
        if tid in sub_refs:
            score += 4
        if any(r == major or r.startswith(major + "-") for r in sub_refs):
            score += 2
        cands.append((score, n))
    if not cands:
        return None
    cands.sort(key=lambda x: -x[0])
    if len(cands) > 1 and cands[0][0] == cands[1][0]:
        warnings.append(f"{tid}：根科判「{top['raw']}」在总表中有多处同分匹配，取第一处")
    return cands[0][1]


def strip_private(n):
    n.pop("_c", None)
    n.pop("_tail", None)
    for v in n["verses"]:
        v.pop("_y", None)
    for c in n["children"]:
        strip_private(c)


def assign_ids(n, prefix="k"):
    for i, c in enumerate(n["children"], 1):
        c["id"] = f"{prefix}.{i}" if prefix != "k" else f"k{i}"
        assign_ids(c, c["id"])


def stats(root):
    nodes = sum(1 for n, _ in walk(root)) - 1
    verses = sum(len(n["verses"]) for n, _ in walk(root))
    stanzas = sum(len(v.get("stanzas", [])) for n, _ in walk(root) for v in n["verses"])
    return {"nodes": nodes, "verseCells": verses, "stanzas": stanzas}


def validate(root):
    """自检：「分N」应等于实际子科判数；同级序号应为 1..N；无子科判的应有颂词。"""
    out = []
    for n, path in walk(root):
        if n is root:
            continue
        kids = n["children"]
        where = f"{n.get('id')} {n['raw']}"
        if n.get("divisions") and n["divisions"] != len(kids):
            out.append(f"{where}：写「分{n['divisions']}」，实际 {len(kids)} 个子科判")
        nums = [c["num"] for c in kids if c["level"]]
        if nums and nums != list(range(1, len(nums) + 1)):
            out.append(f"{where}：子科判序号不连续 {nums}")
        lv = {c["level"] for c in kids if c["level"]}
        if len(lv) > 1:
            out.append(f"{where}：子科判层级不一致 {sorted(lv)}")
        if n["level"] and not kids and not n["verses"]:
            n["noVerse"] = True
    return out


def apply_fixes(root, path, warnings):
    """勘误文件格式：[{"match": "原文科判开头", "table": "表4-1"(可选), "set": {字段: 值}, "replace": ["旧", "新"], "reason": "说明"}]
    match 与科判原文 raw 的开头比对，必须恰好命中一个节点。"""
    fixes = json.load(open(path, encoding="utf-8"))
    done = []
    for fx in fixes:
        hits = [n for n, _ in walk(root) if n is not root and n["raw"].startswith(fx["match"])
                and (not fx.get("table") or fx["table"] in n.get("seenIn", [n["src"]["table"]]))]
        if len(hits) != 1:
            warnings.append(f"勘误「{fx['match']}」命中 {len(hits)} 个科判，未套用")
            continue
        n = hits[0]
        before = n["raw"]
        if fx.get("replace"):
            old, new = fx["replace"]
            n["raw"] = n["raw"].replace(old, new, 1)
        for k, v in fx.get("set", {}).items():
            n[k] = v
        n.setdefault("corrected", []).append({"from": before, "reason": fx.get("reason", "")})
        done.append({"id": n["id"], "from": before, "to": n["raw"], "reason": fx.get("reason", "")})
    return done


def parse_meta(lines):
    meta = {}
    if lines:
        meta["title"] = lines[0]
    blob = " ".join(lines[1:])
    meta["credits"] = blob
    m = re.search(r"(\S+)\s*整理", blob)
    if m:
        meta["compiler"] = m.group(1)
    m = re.search(r"校对\s*(.+)$", blob)
    if m:
        meta["proofreaders"] = m.group(1).split()
    m = re.search(r"(\d{8})\s*(\d+\s*稿)", blob)
    if m:
        meta["date"] = m.group(1)
        meta["edition"] = clean(m.group(2))
    meta["roles"] = re.findall(r"(\S+)\s+(造论|释论|译讲)", blob)
    meta["roles"] = [{"name": a, "role": b} for a, b in meta["roles"]]
    return meta


def parse_pages(spec, n):
    if not spec:
        return list(range(1, n + 1))
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += list(range(int(a), int(b or a) + 1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--pages", help="只转换这些页，如 1-6 或 1,4,5")
    ap.add_argument("--id", default="book")
    ap.add_argument("--fixes", help="人工勘误 JSON（原 PDF 有误、需要我们自己修正的地方）")
    args = ap.parse_args()

    warnings = []
    pdf = pdfplumber.open(args.pdf)
    pages = parse_pages(args.pages, len(pdf.pages))
    tables, meta_lines = [], []
    for pno in pages:
        tinfo, hdr = parse_page(pdf.pages[pno - 1], pno, warnings)
        if pno == 1:
            meta_lines = hdr
        tables += tinfo

    tables.sort(key=lambda t: (table_sort_key(t["id"]), t["page"]))
    root = {"level": None, "name": "ROOT", "children": [], "verses": [], "refs": [],
            "src": {"table": "", "page": 0}}
    table_list = []
    for t in tables:
        tops = table_to_tree(t, warnings)
        table_list.append({"id": t["id"], "title": t["title"], "page": t["page"]})
        for top in tops:
            tgt = find_target(root, top, t["id"], warnings)
            if tgt is None:
                if root["children"] and top["level"]:
                    warnings.append(f"{t['id']}：根科判「{top['raw']}」在已有科判中找不到，放在最外层")
                root["children"].append(top)
            else:
                merge_into(tgt, top, warnings)

    strip_private(root)
    assign_ids(root)
    corrections = apply_fixes(root, args.fixes, warnings) if args.fixes else []
    checks = validate(root)
    out = {
        "id": args.id,
        "meta": parse_meta(meta_lines),
        "source": {"file": args.pdf.split("/")[-1], "pages": pages},
        "tables": table_list,
        "stats": stats(root),
        "warnings": warnings,
        "checks": checks,
        "corrections": corrections,
        "tree": root["children"],
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps(out["stats"], ensure_ascii=False), f"warnings={len(warnings)}", file=sys.stderr)
    for w in warnings:
        print("  ⚠", w, file=sys.stderr)
    print(f"自检：{len(checks)} 处问题", file=sys.stderr)
    for w in checks:
        print("  ✗", w, file=sys.stderr)


if __name__ == "__main__":
    main()
