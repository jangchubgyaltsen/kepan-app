#!/usr/bin/env python3
"""把 sources/ 里每部书的原文件转成 app 用的数据。内置的书用它生成。

    python3 tools/build_all.py [书的代号 …]

约定：每部书一个文件夹 sources/<代号>/，里面放
    *.pdf        科判（Word 导出的表格式 PDF），必须有且只有一个
    *.epub       讲记 / 释论，可选
    fixes.json   人工勘误，可选（格式见 tools/pdf2kepan.py 的 apply_fixes）
    book.json    可选，补充或覆盖书的信息，如 {"title": "入菩萨行论"}；"pages": "1-7" 只转换这些页

输出：
    data/<代号>.json          科判树和颂词
    data/<代号>.shiyi.json    释义（有讲记时）
    data/reports/<代号>-讲记对照.html
    data/books.json           书目，app 首页书架用
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import epub2shiyi  # noqa: E402
import pdf2kepan  # noqa: E402

SRC, DATA = ROOT / "sources", ROOT / "data"


def dump(path, obj, indent=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
    path.write_text(text + "\n", encoding="utf-8")


def build(book_dir):
    bid = book_dir.name
    pdfs = sorted(book_dir.glob("*.pdf"))
    if len(pdfs) != 1:
        raise SystemExit(f"{bid}：要有且只有一个科判 PDF，现在有 {len(pdfs)} 个")
    fixes = book_dir / "fixes.json"
    extra = book_dir / "book.json"
    info = json.loads(extra.read_text(encoding="utf-8")) if extra.exists() else {}
    pages = info.pop("pages", None)  # 只转换这些页，如 "1-7"（跳过只列了后面品名的空表）
    tree = pdf2kepan.convert(str(pdfs[0]), bid, str(fixes) if fixes.exists() else None, pages)
    tree["meta"].update(info)
    dump(DATA / f"{bid}.json", tree, indent=1)
    entry = {"id": bid, "meta": tree["meta"], "stats": tree["stats"], "checks": len(tree["checks"]),
             "corrections": len(tree["corrections"]), "data": f"{bid}.json"}
    print(f"{bid}：{tree['stats']['nodes']} 个科判，自检 {len(tree['checks'])} 处问题，勘误 {len(tree['corrections'])} 条")
    for c in tree["checks"]:
        print("  ✗", c)

    epubs = sorted(book_dir.glob("*.epub"))
    if epubs:
        sh = epub2shiyi.convert(str(epubs[0]), tree)
        dump(DATA / f"{bid}.shiyi.json", sh)
        title = tree["meta"].get("title") or bid
        rep = DATA / "reports" / f"{bid}-讲记对照.html"
        rep.parent.mkdir(parents=True, exist_ok=True)
        rep.write_text(epub2shiyi.build_report(sh, title), encoding="utf-8")
        s = sh["stats"]
        typos = sum(1 for v in sh["report"]["verseDiffs"] for d in v["diffs"] if d["kind"] == "疑似错字")
        entry.update(shiyi=f"{bid}.shiyi.json", report=f"reports/{bid}-讲记对照.html",
                     shiyiStats={"sections": s["sections"], "chars": s["chars"], "typos": typos,
                                 "nameDiffs": s["nameDiffs"], "unmatched": s["missing"] + s["extra"]})
        print(f"  讲记：{s['sections']}/{s['nodes']} 科挂上释义，颂词疑似错字 {typos}，科名不同 {s['nameDiffs']}")
    return entry


def main():
    want = set(sys.argv[1:])
    dirs = [d for d in sorted(SRC.iterdir()) if d.is_dir() and (not want or d.name in want)]
    books_path = DATA / "books.json"
    books = {b["id"]: b for b in json.loads(books_path.read_text(encoding="utf-8"))} if books_path.exists() else {}
    for d in dirs:
        books[d.name] = build(d)
    # 删掉 sources 里已经没有的书
    have = {d.name for d in SRC.iterdir() if d.is_dir()}
    dump(books_path, [b for k, b in sorted(books.items()) if k in have], indent=1)


if __name__ == "__main__":
    main()
