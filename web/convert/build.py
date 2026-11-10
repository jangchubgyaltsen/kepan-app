#!/usr/bin/env python3
"""把转换程序打包成浏览器能直接用的单个 JS 文件和一个试用页。

    python3 web/convert/build.py

输出：
    web/convert/dist/kepan-convert.js   ES module，导出 createConverter()（见 api.js 顶部说明）
    web/convert/dist/demo.html          单文件试用页：选科判 PDF、讲记 epub，出数据和对照报告

    web/convert/dist/pyodide/           运行环境 Pyodide 的核心文件（要和上面两个文件放在一起发布）

依赖的纯 Python 包（pdfplumber、pdfminer.six、charset-normalizer）以 wheel 形式嵌进 JS。
第一次运行时用 pip、npm 把 wheel 和 Pyodide 下载到 web/convert/vendor/（不提交）。
"""
import base64
import io
import json
import pathlib
import subprocess
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
VENDOR = HERE / "vendor"
DIST = HERE / "dist"
PKGS = ["pdfplumber==0.11.4", "pdfminer.six==20231228", "charset-normalizer==3.3.2"]
PY_FILES = ["tools/pdf2kepan.py", "tools/epub2shiyi.py"]
PYODIDE = "0.27.7"
PYODIDE_FILES = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]
# 中文科判只用得到简体（GB）和繁体（CNS / Big5）的 CMap，日文、韩文的不带，能省下一半体积
KEEP_CMAP = ("GB", "CNS", "B5", "ETen", "HKscs", "Identity", "__init__")


def ensure_wheels():
    VENDOR.mkdir(exist_ok=True)
    have = list(VENDOR.glob("*.whl"))
    if len(have) < len(PKGS):
        subprocess.check_call([sys.executable, "-m", "pip", "download", "--no-deps", "-q", "-d", str(VENDOR), *PKGS])
    return sorted(VENDOR.glob("*.whl"))


def ensure_pyodide():
    """从 npm 取 Pyodide 核心文件（不需要任何附加包）。"""
    d = VENDOR / f"pyodide-{PYODIDE}"
    if not (d / "pyodide.asm.wasm").exists():
        import tarfile
        VENDOR.mkdir(exist_ok=True)
        subprocess.check_call(["npm", "pack", f"pyodide@{PYODIDE}", "--silent", "--pack-destination", str(VENDOR)])
        tgz = VENDOR / f"pyodide-{PYODIDE}.tgz"
        d.mkdir(exist_ok=True)
        with tarfile.open(tgz) as tf:
            for f in PYODIDE_FILES:
                (d / f).write_bytes(tf.extractfile(f"package/{f}").read())
        tgz.unlink()
    return d


def slim(path):
    """去掉 dist-info 和用不到的 CMap，重新打包成 zip。"""
    src = zipfile.ZipFile(path)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as out:
        for n in src.namelist():
            if ".dist-info/" in n:
                continue
            base = n.rsplit("/", 1)[-1]
            if "/cmap/" in n and not any(k in base for k in KEEP_CMAP):
                continue
            out.writestr(n, src.read(n))
    return buf.getvalue()


def main():
    wheels = {p.name: base64.b64encode(slim(p)).decode() for p in ensure_wheels()}
    py = {pathlib.Path(f).name: (ROOT / f).read_text(encoding="utf-8") for f in PY_FILES}
    engine = (HERE / "engine.js").read_text(encoding="utf-8")
    engine = engine.replace("__PY_FILES__", json.dumps(py, ensure_ascii=False)).replace("__WHEELS__", json.dumps(wheels))
    api = (HERE / "api.js").read_text(encoding="utf-8")
    DIST.mkdir(exist_ok=True)
    pyo = DIST / "pyodide"
    pyo.mkdir(exist_ok=True)
    src = ensure_pyodide()
    for f in PYODIDE_FILES:
        (pyo / f).write_bytes((src / f).read_bytes())
    js = "// 由 web/convert/build.py 生成，请勿手改\n" + engine + "\n" + api
    (DIST / "kepan-convert.js").write_text(js, encoding="utf-8")
    demo = (HERE / "demo.html").read_text(encoding="utf-8")
    module = js.replace("export function createConverter", "function createConverter")
    demo = demo.replace("/*__CONVERTER__*/", module.replace("</script", "<\\/script"))
    (DIST / "demo.html").write_text(demo, encoding="utf-8")
    for f in ("kepan-convert.js", "demo.html", *[f"pyodide/{x}" for x in PYODIDE_FILES]):
        print(f, f"{(DIST / f).stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
