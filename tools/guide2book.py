#!/usr/bin/env python3
"""引导文类的书：正文是长篇引导散文，科判写在正文里，中间穿插念诵仪轨（藏文 / 音译 / 汉义）和偈颂。

    python3 tools/guide2book.py 大圆满前行引导文.epub --id qxyd -o data/

一次生成两个文件：
  * <id>.json        科判树（格式同 epub2kepan.py）。要背的「颂词」是每一引首尾的祈祷颂、礼赞偈，
                     和仪轨里有汉义的偈句（四句一颂）；挂在它所在的最末一科上。
  * <id>.shiyi.json  每一行（最末一科、序、传记、结文）要显示的全文，kind = "guide"，
                     app 的阅读页直接把正文排出来，不用点开。

和论典不同的地方：
  * 书前的序、译序、传记各自成一行，放在阅读页最上面；
  * 书前的《前行念诵仪轨·开显解脱道》单独成一部分（part），按小标题分成几段，里面的偈句也能背；
  * 上层科判（甲乙丙）底下、第一个子科判之前的文字（品名、品首礼赞等），显示在它的第一个最末一科里；
  * 书末集中排的脚注，按正文里的注号放回所在的那一行。
"""
import argparse
import html
import json
import pathlib
import posixpath
import re
import sys
import zipfile
from urllib.parse import unquote
from xml.etree import ElementTree as ET

import epub2kepan
import epub2shiyi as e2
from pdf2kepan import split_stanzas, walk

SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹"
SUP_RE = re.compile(f"[{SUPS}]+")
UNSUP = str.maketrans(SUPS, "0123456789")
CJK = r"㐀-鿿"


def read_paras(path):
    """同 epub2shiyi.read_epub，但保留音译和汉义之间的制表符（\\t）。"""
    z = zipfile.ZipFile(path)
    cont = ET.fromstring(z.read("META-INF/container.xml"))
    opf_path = next(e.get("full-path") for e in cont.iter() if e.tag.endswith("rootfile"))
    opf_dir = posixpath.dirname(opf_path)
    opf = ET.fromstring(z.read(opf_path))
    manifest, spine = {}, []
    for e in opf.iter():
        tag = e.tag.split("}")[-1]
        if tag == "item":
            manifest[e.get("id")] = unquote(e.get("href"))
        elif tag == "itemref":
            spine.append(e.get("idref"))
    paras, tables = [], []
    for sid in spine:
        href = manifest.get(sid)
        if not href:
            continue
        try:
            s = z.read(posixpath.normpath(posixpath.join(opf_dir, href))).decode("utf-8")
        except KeyError:
            continue
        body = s[s.find("<body"):] if "<body" in s else s
        tables += [read_table(t) for t in re.findall(r"<table\b.*?</table>", body, re.S)]
        for m in e2.PARA_RE.finditer(body):
            cm = e2.CLASS_RE.search(m.group(2))
            cls = cm.group(1).split()[0] if cm else m.group(1)
            inner = re.sub(r"<br\s*/?>", "\n", m.group(3))
            inner = re.sub(r"<a\b[^>]*(?:noteref|_idFootnoteLink)[^>]*>\s*(\d+)\s*</a>",
                           lambda a: a.group(1).translate(e2.SUP), inner)
            text = html.unescape(re.sub(r"<[^>]+>", "", inner))
            text = re.sub(r"[ 　]+", " ", text)
            text = re.sub(r" *\t[ \t]*", "\t", text).strip()
            if text:
                paras.append({"cls": cls, "text": text})
    return paras, tables


def read_table(src):
    """表格 → [[{t: [各行文字], rs?, cs?}]]，保留合并单元格。"""
    rows = []
    for tr in re.findall(r"<tr\b.*?</tr>", src, re.S):
        cells = []
        for m in re.finditer(r"<td\b([^>]*?)(?:/>|>(.*?)</td>)", tr, re.S):
            attrs, inner = m.group(1), m.group(2) or ""
            lines = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<p\b[^>]*>(.*?)</p>", inner, re.S)]
            c = {"t": [x for x in lines if x]}
            for k, a in (("rs", "rowspan"), ("cs", "colspan")):
                ma = re.search(rf'{a}="(\d+)"', attrs)
                if ma and int(ma.group(1)) > 1:
                    c[k] = int(ma.group(1))
            cells.append(c)
        rows.append(cells)
    return rows


def has_cjk(t):
    return bool(re.search(f"[{CJK}]", t))


def is_tibetan(t):
    return bool(re.search(r"[ༀ-࿿]", t)) and not has_cjk(t)


def verse_zh(zh):
    """仪轨汉义一句能不能背：3–11 个汉字、中间不带标点（开头的「啊」「吽！」这类种子字去掉）。"""
    if not zh:
        return None
    t = re.sub(rf"^[{CJK}]{{1,2}}[！!]?\s+", "", zh.strip()) if re.match(rf"^[{CJK}]{{1,2}}[！!]?\s+[{CJK}]", zh.strip()) else zh.strip()
    t = re.sub(r"[（(][^）)]*[）)]", "", t).strip()
    if re.fullmatch(rf"[{CJK}]{{4,11}}[，。！；]?", t):
        return t.rstrip("，。！；")
    return None


class Row:
    def __init__(self, rid, name):
        self.id, self.name, self.items = rid, name, []


def convert(epub_path, book_id, skip_verses=()):
    """skip_verses：这些科（按科名）里的仪轨只显示、不背，如三十七堆曼茶罗的供品清单。"""
    paras, tables = read_paras(epub_path)
    table_title = None
    e2.classify(paras)
    tree = epub2kepan.convert(epub_path, book_id)
    main = tree["tree"][0]
    nodes = [n for n, _ in walk(main)]
    heads = [k for k, p in enumerate(paras) if p["type"] == "heading"]
    if len(heads) != len(nodes):
        raise SystemExit(f"科判标题 {len(heads)} 个，科判树 {len(nodes)} 个，对不上")
    head_node = dict(zip(heads, nodes))
    main["name"] = "大圆满龙钦宁提前行引导文"

    # ------------------------------------------------------------ 逐段归到「目标」上
    front, part_kids, tails = [], [], []
    part = {"level": None, "depth": 1, "num": None, "name": "前行念诵仪轨·开显解脱道", "divisions": None,
            "chapter": "念诵仪轨", "refs": [], "note": None, "raw": "前行念诵仪轨·开显解脱道", "children": [],
            "verses": [], "src": {"table": "epub", "page": 0}, "part": True, "noexp": True}
    sec = {}          # 科判节点 id → 段落（还没合并到行）
    part_lead = []
    where = {}        # 段落序号 → 行（或科判节点）id，用来放回脚注
    footnotes = {}
    target = None     # ("front", Row) / ("part", Row|None) / ("node", node) / ("tail", Row)
    mode = "skip"
    pending_chapter = None
    lead_buf = []     # 品名、品首礼赞：出现在下一科标题之前，归到下一科
    sub = None

    def items_of(t):
        kind, obj = t
        if kind == "node":
            return sec.setdefault(obj["id"], [])
        if kind == "partlead":
            return part_lead
        if kind == "lead":
            return lead_buf
        return obj.items

    def new_sub(name):
        nonlocal sub, target
        sub = Row(None, name)
        part_kids.append(sub)
        target = ("part", sub)

    last_ritual = None
    for k, p in enumerate(paras):
        c, t, ty = p["cls"], p["text"], p["type"]
        if ty == "footnote":
            m = re.match(r"^(\d+)\s*([\s\S]*)$", t)
            if m:
                footnotes[int(m.group(1))] = m.group(2)
            continue
        if c.startswith("其他_表格"):
            continue
        if c == "正文_【译作】二级标题" and tables and mode == "tail":
            table_title = t
            continue
        if c.startswith("科判_") or c.startswith("目录_") or c.startswith("扉页_") or c.startswith("其他_题注") \
                or "相关阅读" in c or c.startswith("ParaOverride"):
            if c.startswith("目录_") or "相关阅读" in c:
                mode = "skip"
            continue
        # ---- 切换目标
        if c.startswith("序_") and "书名" in c:
            r = Row(f"q{len(front) + 1}", t)
            front.append(r)
            target, mode = ("front", r), "front"
            continue
        if c == "正文_正文-书名" and "开显解脱道" in t:
            target, mode = ("partlead", None), "part"
            part_lead.append({"type": "title", "text": t})
            continue
        if c == "正文_正文-书名" and mode == "part":
            target, mode = ("node", main), "main"   # 引导文的书名、作者、礼赞，归到全论那一层
            items_of(target).append({"type": "title", "text": t})
            continue
        if ty == "heading" and mode in ("main", "part"):
            mode = "main"
            n = head_node[k]
            target = ("node", n)
            if lead_buf:
                sec.setdefault(n["id"], [])[:0] = lead_buf
                lead_buf = []
            if pending_chapter:
                n["chapter"] = pending_chapter
                pending_chapter = None
            last_ritual = None
            continue
        if c == "正文_【译作】一级标题" and mode == "main" and t.strip() == "结文":
            r = Row(f"z{len(tails) + 1}", t)
            tails.append(r)
            target, mode = ("tail", r), "tail"
            continue
        if mode == "main" and (ty == "chapter" or c == "正文_【译作】一级标题"):
            target = ("lead", None)
        if mode == "skip" or target is None:
            continue
        # ---- 念诵仪轨的小段落
        if mode == "part":
            if c == "其他_开显解脱道小标题":
                if is_tibetan(t):
                    sub_pending_bo = t
                    if target[0] == "part" and target[1] and not target[1].items:
                        target[1].items.append({"type": "ritual", "bo": t, "head": True})
                    else:
                        new_sub(None)
                        sub.items.append({"type": "ritual", "bo": t, "head": True})
                    last_ritual = None
                    continue
                name = t.rstrip("：:")
                short = len(name) <= 10 and not name.endswith("为例")
                if short:
                    if target[0] == "part" and target[1] and target[1].name is None:
                        target[1].name = name
                    else:
                        new_sub(name)
                    last_ritual = None
                    continue
                items_of(target).append({"type": "small", "text": t})
                last_ritual = None
                continue
            if target[0] == "partlead" and "仪轨" in c and part_lead and any(x["type"] == "small" for x in part_lead):
                new_sub(None)
            m = re.match(r"^第([一二三四五六七八九十])观修法竟$", t)
            if m and target[0] == "part":
                items_of(target).append({"type": "small", "text": t})
                if target[1].name is None:
                    target[1].name = "第" + m.group(1) + "观修法"
                target = ("part", None)
                last_ritual = None
                continue
            if target[0] == "part" and target[1] is None:
                new_sub(None)
        # ---- 段落 → 条目
        dst = items_of(target)
        where[k] = target
        if "仪轨" in c:
            lang = "bo" if "藏文" in c else "py" if "音译" in c else "zh"
            r = last_ritual
            if lang == "zh" and r is not None and r.pop("_tab", False):
                # 「耶南巴达巴⇥王亲色戒萨耶」后面另有汉文行：制表符只是音译里的停顿，不是音译和汉义的分隔
                r["py"] = r["py"] + " " + r.pop("zh")
            if lang == "bo" or r is None or r.get(lang) or (lang == "py" and r.get("zh")):
                r = {"type": "ritual"}
                dst.append(r)
            if lang == "py" and "\t" in t:
                r["py"], r["zh"] = [x.strip() for x in t.split("\t", 1)]
                r["_tab"] = True
            else:
                r[lang] = t.replace("\t", " ")
            last_ritual = r
            continue
        if last_ritual is not None:
            last_ritual.pop("_tab", None)
        last_ritual = None
        if ty == "chapter":
            name = SUP_RE.sub("", t)
            pending_chapter = re.sub(r"^[一二三四五六七八九十]+\s*", "", name).strip()
            dst.append({"type": "title", "text": t})
        elif ty == "gatha":
            dst.append({"type": "verse", "text": t})
        elif c == "正文_【译作】一级标题":
            dst.append({"type": "title", "text": t})
        elif "落款" in c or "作者" in c or "结文" in c or "书名" in c or "三语" in c:
            dst.append({"type": "small", "text": t})
        else:
            dst.append({"type": "text", "text": t.replace("\t", " ")})

    if tables:  # 书末的附表（如吐蕃王朝世系表）单独成一行，排在结文后面
        r = Row(f"z{len(tails) + 1}", table_title or "附表")
        r.items = [{"type": "table", "rows": tb} for tb in tables]
        tails.append(r)

    # ------------------------------------------------------------ 念诵仪轨：小段成为子科判
    for i, r in enumerate(part_kids, 1):
        if r.name is None:
            r.name = f"第{i}段"
    if part_kids:
        part_kids[0].items[:0] = part_lead
    for i, r in enumerate(part_kids, 1):
        r.id = f"r.{i}"
        part["children"].append({"level": None, "depth": 2, "num": i, "name": r.name, "divisions": None,
                                 "chapter": None, "refs": [], "note": None, "raw": r.name, "children": [],
                                 "verses": [], "src": {"table": "epub", "page": 0}, "id": r.id})
    part["id"] = "r"
    part["divisions"] = len(part_kids)

    # ------------------------------------------------------------ 合并成「行」：上层科判的文字放进它的第一个最末一科
    def first_leaf(n):
        while n["children"]:
            n = n["children"][0]
        return n
    heads_of = {}     # 最末一科 → 以它为第一个最末一科的上层科判（外层在前）
    for n in nodes:   # 先序
        heads_of.setdefault(first_leaf(n)["id"], []).append(n)
    rows = {}
    for r in front:
        rows[r.id] = r.items
    for r in part_kids:
        rows[r.id] = r.items
    for n in nodes:
        if not n["children"]:
            chain = [it for m in heads_of[n["id"]] for it in sec.get(m["id"], [])]
            if chain:
                rows[n["id"]] = chain
    for r in tails:
        rows[r.id] = r.items

    for its in rows.values():
        for it in its:
            it.pop("_tab", None)

    # ------------------------------------------------------------ 脚注放回注号所在的行
    note_row = {}
    for rid, its in rows.items():
        for it in its:
            for s in (it.get("text"), it.get("zh"), it.get("py")):
                for m in SUP_RE.finditer(s or ""):
                    note_row.setdefault(int(m.group(0).translate(UNSUP)), rid)
    lost = []
    for num, txt in sorted(footnotes.items()):
        rid = note_row.get(num)
        if rid is None:
            lost.append(num)
            continue
        rows[rid].append({"type": "footnote", "n": num, "text": txt})

    # ------------------------------------------------------------ 每行里能背的颂：偈颂两段一颂，仪轨汉义四句一颂
    leaf_by_id = {n["id"]: n for n in nodes if not n["children"]}
    leaf_by_id.update({c["id"]: c for c in part["children"]})
    total = 0
    whole = {r.id for r in part_kids if re.match(r"^第.观修法$", r.name or "")}
    skip = {n["id"] for n in nodes if n["name"] in skip_verses}
    for rid, its in rows.items():
        stanzas, run, run_items = [], [], []

        def flush():
            nonlocal run, run_items
            if not run:
                return
            if run[0][0] == "g":
                text = "".join(x[1] for x in run)
                sts = split_stanzas(text)
                # 每个条目落在第几颂
                pos, starts, acc = 0, [], 0
                for s in sts:
                    starts.append(acc)
                    acc += len(s)
                for (kind, t), it in zip(run, run_items):
                    it["s"] = len(stanzas) + max(i for i, s0 in enumerate(starts) if s0 <= pos)
                    pos += len(t)
                stanzas.extend(sts)
            else:
                # 开显解脱道的四个观修法各是七句一偈，整段算一颂；其余四句一颂
                size = len(run) if rid in whole else 4
                for i in range(0, len(run), size):
                    chunk = run[i:i + size]
                    for it in run_items[i:i + size]:
                        it["s"] = len(stanzas)
                    stanzas.append("，".join(x[1] for x in chunk) + "。")
            run, run_items = [], []
        for it in its:
            if it["type"] == "verse":
                if run and run[0][0] != "g":
                    flush()
                run.append(("g", it["text"]))
                run_items.append(it)
            elif it["type"] == "ritual" and rid not in skip and not it.get("head") and verse_zh(it.get("zh")):
                if run and run[0][0] != "r":
                    flush()
                run.append(("r", verse_zh(it["zh"])))
                run_items.append(it)
            elif it["type"] == "footnote":
                continue
            else:
                flush()
        flush()
        if stanzas and rid in leaf_by_id:
            leaf_by_id[rid]["verses"] = [{"kind": "verse", "text": "".join(stanzas), "stanzas": stanzas,
                                          "src": {"table": "epub", "page": 0}}]
            total += len(stanzas)
        elif stanzas:
            for it in its:
                it.pop("s", None)

    # ------------------------------------------------------------ 拼成输出
    top = {"level": None, "name": "ROOT", "children": [part, main], "verses": [], "refs": []}
    st = {"nodes": sum(1 for _ in walk(top)) - 1,
          "verseCells": sum(len(n["verses"]) for n, _ in walk(top)),
          "stanzas": sum(len(v.get("stanzas", [])) for n, _ in walk(top) for v in n["verses"])}
    fr = [{"level": None, "depth": 0, "num": None, "name": r.name, "divisions": None, "chapter": None, "refs": [],
           "note": None, "raw": r.name, "children": [], "verses": [], "src": {"table": "epub", "page": 0}, "id": r.id}
          for r in front]
    tl = [dict(x, name=r.name, raw=r.name, id=r.id) for x, r in zip(fr[:1] * len(tails), tails)]
    main["chapter"] = None
    tree["tree"] = fr + [part, main] + tl
    tree["stats"] = st
    tree["meta"]["kind"] = "guide"
    tree["warnings"] += [f"脚注 {n} 在正文里没找到注号，没放进去" for n in lost]
    chars = sum(len(it.get("text") or it.get("zh") or "") for its in rows.values() for it in its)
    shiyi = {"bookId": book_id, "kind": "guide",
             "source": {"file": epub_path.split("/")[-1], "epub": {"title": "大圆满前行引导文"}},
             "stats": {"rows": len(rows), "chars": chars, "footnotes": len(footnotes) - len(lost), "stanzas": total},
             "sections": {rid: {"items": its} for rid, its in rows.items()}}
    return tree, shiyi


def main_cli():
    ap = argparse.ArgumentParser()
    ap.add_argument("epub")
    ap.add_argument("--id", required=True)
    ap.add_argument("-o", "--out", required=True, help="输出目录")
    a = ap.parse_args()
    tree, sh = convert(a.epub, a.id)
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{a.id}.json").write_text(json.dumps(tree, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / f"{a.id}.shiyi.json").write_text(json.dumps(sh, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(tree["stats"], ensure_ascii=False), json.dumps(sh["stats"], ensure_ascii=False), file=sys.stderr)
    for w in tree["warnings"]:
        print("  ⚠", w, file=sys.stderr)


if __name__ == "__main__":
    main_cli()
