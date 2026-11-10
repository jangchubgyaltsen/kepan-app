#!/usr/bin/env python3
"""没有可用的科判 PDF 时（例如科判只有扫描件），直接从讲记 epub 的科判标题和颂词搭出科判树。

    python3 tools/epub2kepan.py 讲记.epub -o data/xx.json --id xx

输出格式和 pdf2kepan.py 相同：标题样式里的「甲一、」「乙二（……）分N：……」按层级嵌套，
标题之后、下一个标题之前的颂词段落归这一科；「第N品 ……」品名记在它之后的第一个科判上。
"""
import argparse
import json
import re
import sys

import epub2shiyi as e2
from pdf2kepan import NUMS, apply_fixes, assign_ids, cn2int, split_stanzas, stats, strip_private, validate


def convert(epub_path, book_id="book", fixes=None):
    paras, meta = e2.read_epub(epub_path)
    e2.classify(paras)
    root = {"level": None, "depth": 0, "num": None, "name": "全论", "divisions": None, "chapter": None,
            "refs": [], "note": None, "raw": "全论", "children": [], "verses": [], "src": {"table": "epub", "page": 0}}
    stack, cur, chapter, warnings, seen_label = [root], root, None, [], False
    root_done, base = False, 0
    ch_count, seen_ch = {}, {}
    for p in paras:
        if p["type"] == "chapter":
            ct = re.sub(r"\s+", " ", p["text"]).strip()
            ch_count[ct] = ch_count.get(ct, 0) + 1
    for p in paras:
        t = p["text"]
        if p["type"] == "heading":
            t = re.sub(r"[¹²³⁴⁵⁶⁷⁸⁹⁰]+", "", t)
            # 「（卯二）（人）分二」→「卯二（人）分二」；「［甲一］总处」是亥之后再从甲排起的第二轮
            t = re.sub(rf"^（([{e2.LEVELS}][{NUMS}]+)）", r"\1", t)
            second = bool(re.match(r"^[［\[]", t))
            if second:
                t = re.sub(rf"^[［\[]([{e2.LEVELS}][{NUMS}]+)[］\]]\s*", lambda m: m.group(1) + ("" if t[m.end():m.end() + 1] in "（(" else "、"), t)
            lv, num, name, raw = e2.parse_heading(t)
            struct = None
            if not lv and root_done:
                # 没有天干序号的上层结构（如心性休息）：「一（入造论之初义）分二」→第1层，
                # 「一者顶礼」「暇满难得品分四」→第2层；其下的甲乙丙从这一层往下排
                m1 = re.match(rf"^([{NUMS}]+)（(.+?)）", t)
                m2 = re.match(rf"^([{NUMS}]+)者(.+?)[：:]?$", t)
                m3 = re.match(rf"^(.+?品)分([{NUMS}]+)[：:]", t)
                if m1:
                    struct = (1, cn2int(m1.group(1)), m1.group(2))
                elif m2:
                    struct = (2, cn2int(m2.group(1)), m2.group(2))
                elif m3:
                    struct = (2, None, m3.group(1))
            if struct:
                d, snum, sname = struct
                while len(stack) > 1 and stack[-1]["depth"] >= d:
                    stack.pop()
                par = stack[-1]
                md = re.search(rf"分([{NUMS}]+)[：:]", t)
                node = {"level": None, "depth": d,
                        "num": snum or sum(1 for c in par["children"] if c.get("_struct")) + 1,
                        "name": sname, "divisions": cn2int(md.group(1)) if md else None, "chapter": chapter,
                        "refs": [], "note": None, "raw": re.sub(r"[：:].*$", "", t), "children": [], "verses": [],
                        "src": {"table": "epub", "page": 0}, "_struct": True}
                chapter = None
                par["children"].append(node)
                stack.append(node)
                cur, base, seen_label = node, d, True
                continue
            mnum = re.match(r"^(\d+)[．.、]\s*(.+?)[：:]?$|^第([一二三四五六七八九十]+)(.+?)[：:]?$", t)
            if not lv and seen_label and mnum:
                # 「1．他化天：」「第二法相：」这种编号小标题：作上一个科判的子项
                while stack[-1].get("_numbered"):
                    stack.pop()
                par = stack[-1]
                node = {"level": None, "depth": par["depth"] + 1,
                        "num": int(mnum.group(1)) if mnum.group(1) else (cn2int(mnum.group(3)) if len(mnum.group(3)) <= 2 else None),
                        "name": re.sub(r"[：:]$", "", t), "divisions": None, "chapter": chapter, "refs": [],
                        "note": None, "raw": re.sub(r"[：:]$", "", t), "children": [], "verses": [],
                        "src": {"table": "epub", "page": 0}, "_numbered": True}
                chapter = None
                par["children"].append(node)
                stack.append(node)
                cur = node
                continue
            if not lv:
                md = re.search(rf"分为?([{NUMS}]+)[：:]", t)
                if not root_done and md:  # 「讲……此如意宝藏分为四：论名之义、……」
                    root_done = True
                    root["divisions"] = cn2int(md.group(1))
                    root["raw"] = re.sub(r"[¹²³⁴⁵⁶⁷⁸⁹⁰]+", "", t)
                continue
            seen_label = root_done = True
            depth = base + e2.LEVELS.index(lv) + 1 + (len(e2.LEVELS) if second else 0)
            md = re.search(rf"分([{NUMS}]+)[：:]", t)
            node = {"level": lv, "depth": depth, "num": num,
                    "name": re.sub(r"[¹²³⁴⁵⁶⁷⁸⁹⁰]+", "", name),
                    "divisions": cn2int(md.group(1)) if md else None,
                    "chapter": chapter, "refs": [], "note": None, "raw": re.sub(r"：.*$", "", raw),
                    "children": [], "verses": [], "src": {"table": "epub", "page": 0}}
            chapter = None
            while len(stack) > 1 and stack[-1]["depth"] >= depth:
                stack.pop()
            if stack[-1]["depth"] != depth - 1:
                warnings.append(f"「{raw}」上面缺了一层，挂到「{stack[-1]['raw']}」下")
            stack[-1]["children"].append(node)
            stack.append(node)
            cur = node
        elif p["type"] == "chapter":
            # 目录里也列着品名：同一品名出现多次时只认最后一次（正文那一处）
            ct = re.sub(r"\s+", " ", t).strip()
            seen_ch[ct] = seen_ch.get(ct, 0) + 1
            if seen_ch[ct] == ch_count[ct] and re.match(rf"^第[{NUMS}]+品", ct):
                chapter = ct
        elif p["type"] == "verse" and cur is not root:  # 全论标题之后、第一个科判之前常是颂词全文，不挂
            kind = "note" if re.match(r"^(梵语|藏语|汉语|梵文|藏文)[：:]|^顶礼[^，,。]{1,20}[！!]$", t) else "verse"
            vs = cur["verses"]
            if kind == "verse" and vs and vs[-1]["kind"] == "verse" and vs[-1].get("_open"):
                vs[-1]["text"] += t  # 同一科里连着的颂词行拼成一格
            else:
                vs.append({"kind": kind, "text": t, "src": {"table": "epub", "page": 0}, "_open": True})
        elif p["type"] in ("text", "chapterEnd", "gatha", "footnote") and cur["verses"]:
            cur["verses"][-1]["_open"] = False  # 释文隔开的两段颂词各成一格

    def finish(n):
        n.pop("_numbered", None)
        n.pop("_struct", None)
        for v in n["verses"]:
            v.pop("_open", None)
            if v["kind"] == "verse":
                v["stanzas"] = split_stanzas(v["text"])
            if n["children"]:
                v["pos"] = "before"
        for c in n["children"]:
            finish(c)
    finish(root)
    top = {"level": None, "name": "ROOT", "children": [root], "verses": [], "refs": [], "src": {"table": "", "page": 0}}
    strip_private(top)
    assign_ids(top)
    corrections = apply_fixes(top, fixes, warnings) if fixes else []
    checks = validate(top)
    title = re.sub(r"^译作\s*\d+\s*", "", meta.get("title", "")).replace("-epub", "").strip()
    return {
        "id": book_id,
        "meta": {"title": title, "credits": "", "roles": []},
        "source": {"file": epub_path.split("/")[-1], "from": "epub"},
        "tables": [],
        "stats": stats(top),
        "warnings": warnings,
        "checks": checks,
        "corrections": corrections,
        "tree": [root],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("epub")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--id", default="book")
    ap.add_argument("--fixes")
    a = ap.parse_args()
    out = convert(a.epub, a.id, a.fixes)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps(out["stats"], ensure_ascii=False), f"warnings={len(out['warnings'])}", file=sys.stderr)
    for w in out["warnings"][:30]:
        print("  ⚠", w, file=sys.stderr)
    print(f"自检：{len(out['checks'])} 处问题", file=sys.stderr)
    for c in out["checks"][:40]:
        print("  ✗", c, file=sys.stderr)


if __name__ == "__main__":
    main()
