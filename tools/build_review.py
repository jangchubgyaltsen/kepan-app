#!/usr/bin/env python3
"""生成「转换对照页」：左边原 PDF 页面图，右边从 JSON 还原的科判树和颂词，方便逐表抽查。

用法:
    python3 tools/build_review.py data/rxl.json 原.pdf -o review.html [--dpi 110]
"""
import argparse
import base64
import html
import io
import json

import pypdfium2 as pdfium

LEVELS = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥"


def page_images(pdf_path, pages, dpi):
    doc = pdfium.PdfDocument(pdf_path)
    out = {}
    for p in sorted(set(pages)):
        img = doc[p - 1].render(scale=dpi / 72).to_pil().convert("RGB")
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=60, optimize=True)
        out[p] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    return out


def in_table(n, tid):
    return tid in n.get("seenIn", [n["src"]["table"]])


def touches(n, tid):
    return in_table(n, tid) or any(v["src"]["table"] == tid for v in n["verses"]) or any(touches(c, tid) for c in n["children"])


def render_node(n, tid):
    if not touches(n, tid):
        return ""
    e = html.escape
    lv = n.get("level") or ""
    d = n.get("depth") or 0
    title = f"{lv}{'' if not n.get('num') else ''}"
    label = e(n["raw"])
    badges = []
    if n.get("divisions") is not None:
        ok = n["divisions"] == len(n["children"])
        badges.append(f'<span class="b {"ok" if ok else "bad"}">分{n["divisions"]}{"" if ok else " · 实得" + str(len(n["children"]))}</span>')
    if n.get("chapter"):
        badges.append(f'<span class="b ch">{e(n["chapter"])}</span>')
    if n.get("note"):
        badges.append(f'<span class="b ch">{e(n["note"])}</span>')
    for c in n.get("corrected", []):
        badges.append(f'<span class="b fix">已勘误，原作「{e(c["from"])}」</span>')
    if n.get("altNames"):
        badges.append(f'<span class="b bad">别名：{e("、".join(n["altNames"]))}</span>')
    verses_before = [v for v in n["verses"] if v["src"]["table"] == tid and v.get("pos") != "after"]
    verses_after = [v for v in n["verses"] if v["src"]["table"] == tid and v.get("pos") == "after"]

    def vhtml(vs):
        parts = []
        for v in vs:
            if v["kind"] == "note":
                parts.append(f'<p class="note">{e(v["text"])}</p>')
            else:
                parts.append('<div class="verse">' + "".join(f"<p>{e(s)}</p>" for s in v["stanzas"]) + "</div>")
        return "".join(parts)

    kids = "".join(render_node(c, tid) for c in n["children"])
    cls = (f"lv{(d - 1) % 6}" if d else "lv-root") + ("" if in_table(n, tid) else " ctx")
    return (f'<li class="{cls}"><div class="k"><span class="id">{e(n["id"])}</span>'
            f'<span class="lab">{label}</span>{"".join(badges)}</div>'
            f'{vhtml(verses_before)}'
            f'{"<ul>" + kids + "</ul>" if kids else ""}{vhtml(verses_after)}</li>')


CSS = """
:root{
  /* 双栏对照：左原页、右还原树；窄屏上下排 */
  --bg:#f3f4f2; --panel:#ffffff; --ink:#1f2422; --muted:#66706b; --line:#d9ddd9;
  --accent:#9b2c1f; --ok:#2f6d4f; --bad:#b4371f; --badbg:#fbe9e4; --okbg:#e5f1ea;
  --l0:#9b2c1f; --l1:#7a4b12; --l2:#2e5d73; --l3:#4d5d2a; --l4:#6a3b6e; --l5:#3c4a8a;
  --serif:"Noto Serif SC","Songti SC","SimSun",serif; --sans:"Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#161918; --panel:#1f2321; --ink:#e6e9e7; --muted:#9aa39e; --line:#343a37;
  --accent:#e0826f; --ok:#7cc3a0; --bad:#f08a72; --badbg:#3a221d; --okbg:#1e3329;
  --l0:#e0826f; --l1:#d9a85c; --l2:#7fb7d1; --l3:#a9bf75; --l4:#c79acb; --l5:#9aa8e6; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#161918; --panel:#1f2321; --ink:#e6e9e7; --muted:#9aa39e; --line:#343a37;
  --accent:#e0826f; --ok:#7cc3a0; --bad:#f08a72; --badbg:#3a221d; --okbg:#1e3329;
  --l0:#e0826f; --l1:#d9a85c; --l2:#7fb7d1; --l3:#a9bf75; --l4:#c79acb; --l5:#9aa8e6; color-scheme:dark}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.6}
.wrap{max-width:1400px;margin:0 auto;padding-block:24px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-family:var(--serif);font-size:1.7rem;margin:0 0 4px;text-wrap:balance}
.credits{color:var(--muted);margin:0 0 16px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px}
.summary>div{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;min-width:0}
.summary h3{margin:0 0 6px;font-size:.8rem;letter-spacing:.06em;color:var(--muted);font-weight:600}
.summary ul{margin:0;padding-left:1.1em;font-size:.88rem}
.num{font-size:1.4rem;font-variant-numeric:tabular-nums;font-weight:600}
nav.toc{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 24px}
nav.toc a{font-size:.85rem;padding:3px 9px;border:1px solid var(--line);border-radius:999px;color:var(--ink);text-decoration:none;background:var(--panel)}
nav.toc a:hover,nav.toc a:focus-visible{border-color:var(--accent);outline:none}
section.t{border-top:2px solid var(--accent);padding-top:12px;margin-top:28px}
section.t h2{font-family:var(--serif);font-size:1.15rem;margin:0 0 12px}
section.t h2 small{color:var(--muted);font-family:var(--sans);font-weight:400;font-size:.8rem;margin-left:8px}
.pair{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:20px;align-items:start}
@media (max-width:820px){.pair{grid-template-columns:1fr}}
.img{position:sticky;top:8px;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:6px}
.img img{display:block;width:100%;height:auto;background:#fff}
.tree{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 12px 12px 4px;min-width:0;overflow-x:auto}
.tree ul{list-style:none;margin:0;padding-left:14px;border-left:1px dashed var(--line)}
.tree>ul{border-left:0;padding-left:8px}
.tree li{margin:4px 0}
.k{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}
.id{font-size:.7rem;color:var(--muted);font-variant-numeric:tabular-nums}
.lab{font-weight:600}
.lv0>.k .lab{color:var(--l0)}.lv1>.k .lab{color:var(--l1)}.lv2>.k .lab{color:var(--l2)}
.lv3>.k .lab{color:var(--l3)}.lv4>.k .lab{color:var(--l4)}.lv5>.k .lab{color:var(--l5)}
.lv-root>.k .lab{color:var(--ink)}
.b{font-size:.72rem;padding:0 6px;border-radius:4px;background:var(--okbg);color:var(--ok)}
.b.bad{background:var(--badbg);color:var(--bad)}
.b.fix{background:var(--badbg);color:var(--accent);font-weight:600}
.b.ch{background:transparent;border:1px solid var(--line);color:var(--muted)}
.verse{font-family:var(--serif);margin:4px 0 6px 14px;padding-left:10px;border-left:3px solid var(--line)}
.verse p{margin:0}
.ctx>.k{opacity:.55}
.note{margin:4px 0 6px 14px;color:var(--muted);font-size:.85rem;font-style:italic}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("pdf")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--dpi", type=int, default=110)
    a = ap.parse_args()
    d = json.load(open(a.json, encoding="utf-8"))
    e = html.escape
    imgs = page_images(a.pdf, [t["page"] for t in d["tables"]], a.dpi)
    m = d["meta"]
    st = d["stats"]
    roles = "　".join(f'{r["name"]} {r["role"]}' for r in m.get("roles", []))
    parts = [f"""<title>善说海科判对照</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&display=swap">
<style>{CSS}</style><div class="wrap">
<h1>{e(m.get("title", ""))}</h1>
<p class="credits">{e(roles)}<br>整理：{e(m.get("compiler", ""))}　校对：{e("、".join(m.get("proofreaders", [])))}　{e(m.get("edition", ""))} {e(m.get("date", ""))}</p>
<div class="summary">
 <div><h3>科判节点</h3><div class="num">{st["nodes"]}</div></div>
 <div><h3>颂词格 / 偈数（按四句计）</h3><div class="num">{st["verseCells"]} / {st["stanzas"]}</div></div>
 <div><h3>自检问题（分N 与实际子科判数不符等）</h3><ul>{"".join(f"<li>{e(c)}</li>" for c in d["checks"]) or "<li>无</li>"}</ul></div>
 <div><h3>人工勘误</h3><ul>{"".join(f"<li>{e(c['from'])} → {e(c['to'])}：{e(c['reason'])}</li>" for c in d.get("corrections", [])) or "<li>无</li>"}</ul></div>
 <div><h3>转换时自动处理的特殊情况</h3><ul>{"".join(f"<li>{e(w)}</li>" for w in d["warnings"]) or "<li>无</li>"}</ul></div>
</div>
<nav class="toc">{"".join(f'<a href="#t{i}">{e(t["id"])}</a>' for i, t in enumerate(d["tables"]))}</nav>"""]
    for i, t in enumerate(d["tables"]):
        tree = "".join(render_node(n, t["id"]) for n in d["tree"])
        parts.append(f"""<section class="t" id="t{i}"><h2>{e(t["title"] or t["id"])}<small>PDF 第 {t["page"]} 页</small></h2>
<div class="pair"><div class="img"><img loading="lazy" src="{imgs[t["page"]]}" alt="PDF 第 {t["page"]} 页"></div>
<div class="tree"><ul>{tree}</ul></div></div></section>""")
    parts.append("</div>")
    open(a.out, "w", encoding="utf-8").write("\n".join(parts))


if __name__ == "__main__":
    main()
