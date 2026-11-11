#!/usr/bin/env python3
"""把 app/、data/ 和浏览器转换模块拼成可以直接发布的网站（PWA）。

    python3 tools/build_app.py              # 输出到 site/
    python3 tools/build_app.py --no-convert # 不带转换模块（只能看和背内置的书，不能导入）

环境变量 PUSH_SERVER：每日提醒的推送服务地址（push/ 里的 Cloudflare Worker），没有就留空。
转换模块由 web/convert/build.py 生成；site/convert/ 下没有时会先运行它（要联网下载 Pyodide）。
"""
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "app"
DATA = ROOT / "data"
CONV = ROOT / "web" / "convert"
OUT = ROOT / "site"


def compact(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def main():
    with_convert = "--no-convert" not in sys.argv
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(APP, OUT)
    (OUT / ".nojekyll").write_text("")

    # 内置的书：data/books.json 里列的科判和释义。
    # 去掉缩进压紧写出（体积约减半，手机上解析也快）；每个文件按内容算版本号写进 books.json，
    # app 用 data/<文件>?v=<版本> 读取，离线缓存按这个网址判断，发新版时没改过的书不用重新下载。
    (OUT / "data").mkdir()
    books = json.loads((DATA / "books.json").read_text(encoding="utf-8"))
    data_files = []
    for b in books:
        b["v"] = {}
        for k in ("data", "shiyi"):
            f = b.get(k)
            if not f:
                continue
            if not (DATA / f).exists():
                b.pop(k)
                continue
            raw = compact(json.loads((DATA / f).read_text(encoding="utf-8")))
            (OUT / "data" / f).write_bytes(raw)
            b["v"][k] = hashlib.sha256(raw).hexdigest()[:10]
            data_files.append(f"data/{f}?v={b['v'][k]}")
    (OUT / "data" / "books.json").write_bytes(compact(books))

    conv_hash = "none"
    if with_convert:
        dist = CONV / "dist"
        if not (dist / "kepan-convert.js").exists():
            subprocess.check_call([sys.executable, str(CONV / "build.py")])
        (OUT / "convert").mkdir()
        shutil.copy(dist / "kepan-convert.js", OUT / "convert" / "kepan-convert.js")
        shutil.copytree(dist / "pyodide", OUT / "convert" / "pyodide")
        h = hashlib.sha256()
        for p in sorted((OUT / "convert").rglob("*")):
            if p.is_file():
                h.update(p.name.encode())
                h.update(p.read_bytes())
        conv_hash = h.hexdigest()[:10]

    (OUT / "config.js").write_text(
        "window.KEPAN_CONFIG = " + json.dumps({"pushServer": os.environ.get("PUSH_SERVER", "").rstrip("/")}) + ";\n",
        encoding="utf-8")

    shell = ["index.html", "app.js", "app.css", "pwa.css", "config.js", "manifest.webmanifest", "vendor/ts-fsrs.umd.js"]
    shell += sorted("icons/" + p.name for p in (OUT / "icons").glob("*.png"))
    pre = shell + ["data/books.json"]
    h = hashlib.sha256(conv_hash.encode())
    for f in pre:
        h.update(f.encode())
        h.update((OUT / f).read_bytes())
    version = h.hexdigest()[:10]
    sw = (OUT / "sw.js").read_text(encoding="utf-8")
    sw = (sw.replace("__VERSION__", version).replace("__CONVHASH__", conv_hash)
            .replace("__PRECACHE__", json.dumps(["./"] + pre, ensure_ascii=False))
            .replace("__DATAFILES__", json.dumps(data_files, ensure_ascii=False)))
    (OUT / "sw.js").write_text(sw, encoding="utf-8")
    app = (OUT / "app.js").read_text(encoding="utf-8").replace('const APPVER="1.0";', f'const APPVER="1.0 · {version[:7]}";')
    (OUT / "app.js").write_text(app, encoding="utf-8")
    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"site/ 已生成，版本 {version}，共 {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
