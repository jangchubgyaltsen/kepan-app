# kepan-app
科判查看与颂词背诵 PWA

## 数据：从 PDF 转换科判

`tools/pdf2kepan.py` 把 Word 导出的「颂词 + 科判」表格式 PDF 转成 JSON（科判树 + 每个科判下的颂词）。
同一格式的其他论典 PDF 可直接复用。

```bash
pip install pdfplumber pypdfium2 pillow
python3 tools/pdf2kepan.py "入行论广释 颂词 科判.pdf" -o data/rxl.json --id rxl
# 生成对照页（左原页图，右还原树），用于抽查
python3 tools/build_review.py data/rxl.json "入行论广释 颂词 科判.pdf" -o review.html
```

转换原理：按单元格几何关系判断上下级（右侧紧贴、上下范围被包含即为子科判），
竖排合并格里叠放的多层科判会被拆开，分表（表1、表2-1……）按「层级字+序号」和「（表X）」引用并入总表。
转换后会自检：「分N」与实际子科判数、同级序号是否连续、层级是否一致。

### JSON 结构（`data/rxl.json`）

- `meta`：标题、造论/释论/译讲、整理者 `compiler`、校对者 `proofreaders`、稿次、日期
- `tables`：原 PDF 中每张表的编号、标题、页码
- `tree`：科判节点数组，每个节点：
  - `id`（如 `k2.2.2.1`）、`level`（甲乙丙…）、`depth`、`num`、`name`、`divisions`（分N）、`chapter`（第X品）、`raw`（原文）
  - `verses`：颂词 `{kind: verse|note, text, stanzas[], pos?}`，`pos: after` 表示在子科判之后
  - `children`：子科判
- `warnings` / `checks`：转换时的特殊处理与自检问题
