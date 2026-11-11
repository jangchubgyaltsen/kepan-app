# kepan-app
科判查看与颂词背诵 PWA

## 内置的书（sources/ → data/）

1. 在 `sources/` 下建一个文件夹，名字就是书的代号，如 `sources/rxl/`。
2. 放进科判 PDF（必须，一个）、讲记 epub（可选）、`fixes.json` 勘误（可选）、`book.json` 书名等补充信息（可选，如 `{"name": "入菩萨行论", "shortName": "入行论"}`）。
3. 运行 `pip install -r requirements.txt && python3 tools/build_all.py`，结果写到 `data/`：`<代号>.json` 科判、
   `<代号>.shiyi.json` 释义、`reports/<代号>-讲记对照.html` 对照报告、`books.json` 书目。

用户自己导入的书在手机上转换（见下面「在浏览器 / 手机上转换」），不经过 GitHub。

## 数据：从 PDF 转换科判

`tools/pdf2kepan.py` 把 Word 导出的「颂词 + 科判」表格式 PDF 转成 JSON（科判树 + 每个科判下的颂词）。
同一格式的其他论典 PDF 可直接复用。

```bash
pip install pdfplumber pypdfium2 pillow
python3 tools/pdf2kepan.py "入行论广释 颂词 科判.pdf" -o data/rxl.json --id rxl --fixes sources/rxl/fixes.json
# 生成对照页（左原页图，右还原树），用于抽查
python3 tools/build_review.py data/rxl.json "入行论广释 颂词 科判.pdf" -o review.html
```

转换原理：按单元格几何关系判断上下级（右侧紧贴、上下范围被包含即为子科判），
竖排合并格里叠放的多层科判会被拆开，分表（表1、表2-1……）按「层级字+序号」和「（表X）」引用并入总表。
转换后会自检：「分N」与实际子科判数、同级序号是否连续、层级是否一致。

原 PDF 本身有误、需要我们修正的地方写在 `sources/<id>/fixes.json`（人工勘误），每次转换后自动套用，
修正记录会写进输出的 `corrections`，并在对照页上标出原文。

### JSON 结构（`data/rxl.json`）

- `meta`：标题、造论/释论/译讲、整理者 `compiler`、校对者 `proofreaders`、稿次、日期
- `tables`：原 PDF 中每张表的编号、标题、页码
- `tree`：科判节点数组，每个节点：
  - `id`（如 `k2.2.2.1`）、`level`（甲乙丙…）、`depth`、`num`、`name`、`divisions`（分N）、`chapter`（第X品）、`raw`（原文）
  - `verses`：颂词 `{kind: verse|note, text, stanzas[], pos?}`，`pos: after` 表示在子科判之后
  - `children`：子科判
- `warnings` / `checks`：转换时的特殊处理与自检问题

## 数据：讲记 / 释论 epub 按科判切分（释义）

`tools/epub2shiyi.py` 把讲记的 epub 按科判切开，每个科判挂上它底下的释文，供阅读页「点颂词看释义」使用；
同时把讲记里的科判标题、颂词和科判表逐条比对，生成一页对照报告。只用 Python 标准库。

```bash
python3 tools/epub2shiyi.py 善说海.epub data/rxl.json -o out/rxl.shiyi.json --report out/rxl.shiyi-report.html
```

- 自动认出科判标题所用的段落样式（大多写成「甲一、」「乙二（……）分N」的那种），不依赖某一本书的样式名；
  按样式名里的「颂词」「脚注」「品名」「前后缀」区分颂词、脚注、品名、释论作者的附偈，其余为释文。
- 讲记标题和科判树按「层级字+序号」序列对齐，对不齐的再按名称相似度配对。
- 颂词逐字比对，差异分成「疑似错字」「用字不同」（须/需、着/著 等）和「多出或缺少」。

### 释义 JSON 结构

- `sections`：以科判 `id` 为键，`{heading, items: [{type, text, stanza?, lead?}]}`
  - `type`：`text` 释文、`verse` 颂词、`footnote` 脚注、`chapter` 品名、`chapterEnd` 品释终、`gatha` 附偈
  - `stanza`：颂词段对应科判表里该科的第几颂（从 0 起），用于高亮
  - `lead`：品名等出现在本科标题之前的引言段落
- `front`：第一个科判之前的内容（序、传记、本论全文等）
- `report`：`nameDiffs` 科名不同、`verseDiffs` 颂词差异、`verseOnlyKepan` / `verseOnlyJiangji`、`missing` / `extra`
- `stats`：对齐与字数统计

讲记有版权，epub 原文件和生成的释义数据默认不提交进仓库（见 `.gitignore`）。

## 数据：引导文类的书（散文为主）

《大圆满前行引导文》这类书正文是长篇引导，科判写在正文里，没有成套的颂词。`book.json` 里写 `"kind": "guide"`，
`build_all.py` 就改用 `tools/guide2book.py`，一次生成科判树和全文：

- 序、译序、传记各成一行，排在阅读页最上面；书末的结文也单独一行；
- 书前的念诵仪轨（藏文 / 音译 / 汉义）自成一部分，按小标题分段；
- 要背的颂：每一引首尾的祈祷颂、礼赞偈（两段一颂），仪轨里有汉义的偈句（四句一颂），挂在所在的最末一科上；
- 开显解脱道的四个观修法各七句，整段算一颂；`book.json` 的 `skipVerses` 列出的科（按科名）里的仪轨只显示不背，如三十七堆曼茶罗的供品清单；
- 仪轨偈句在科判树的颂词格里带 `py`（每颂每句的音译），背诵时一句一行、打乱顺序、音译在上，只遮汉义；
- 有音译的最末一科另有「对照」题（stepsOf 里的 `pair`）：一次最多 8 句、打乱顺序，单数句看汉义选音译、双数句看音译选汉义，四选一；
- 书末的附表（吐蕃王朝世系表）按原表格排，保留合并单元格；
- 上层科判底下、第一个子科判之前的文字（品名、品首礼赞）显示在它的第一个最末一科里；书末的脚注按注号放回原处。

`<id>.shiyi.json` 的 `kind` 是 `guide`，`sections` 以「行」的 id 为键，条目类型：`text` 正文、`title` 标题、`small` 落款 / 说明、
`verse` 偈颂、`ritual` 仪轨一句（`bo` 藏文、`py` 音译、`zh` 汉义）、`footnote` 脚注；能背的条目带 `s`（第几颂）。
app 阅读页对这类书直接排出全文（不用点开释义），工具栏的「藏文」切换仪轨里的藏文。

## 在浏览器 / 手机上转换

`web/convert/` 把上面两个 Python 程序原样放进浏览器里跑（Pyodide），手机上选文件就能转换，不经过服务器，结果和电脑上完全一致。

```bash
python3 web/convert/build.py     # 生成 web/convert/dist/：kepan-convert.js、demo.html、pyodide/
```

app 里这样用（`dist/` 整个目录一起发布，`pyodide/` 要和 `kepan-convert.js` 放在同一层）：

```js
import { createConverter } from './convert/kepan-convert.js';
const conv = createConverter({ onLog: (s) => console.log(s) });
const tree = await conv.kepanFromPdf(pdfFile, { id: 'rxl', fixes, onProgress: (i, n) => {} });  // 同 data/rxl.json
const { data, reportHtml, suggestions } = await conv.shiyiFromEpub(epubFile, tree);            // 释义数据 + 对照报告 + 勘误建议
const fixed = await conv.applyFixes(tree, suggestions.map((s) => s.fix));                       // 用户确认后套用，返回新的 tree 和重新比对的结果
```

- 默认在 Web Worker 里跑，不卡界面；不允许 Worker 时自动退回主线程。
- 第一次要下载约 15MB（运行环境 14MB + 转换程序 4MB），之后由浏览器缓存；PWA 可以把 `dist/` 放进离线缓存。
- 入行论 32 页在电脑浏览器里约 12 秒，善说海 epub 约 1 秒；手机上会慢一些。
- 不支持加密 PDF（浏览器版没有带解密库）。

## 应用本体（`app/` → GitHub Pages）

`app/` 是正式版的离线网页应用（PWA），由原型 `prototype/` 定稿后移植而来，不用任何框架。

```bash
python3 tools/build_app.py              # 生成 site/：应用 + data/ 里的内置书 + 转换模块，约 20MB
python3 tools/build_app.py --no-convert # 不带转换模块（只能看和背内置的书，不能导入）
cd site && python3 -m http.server 8000  # 本地试用：http://localhost:8000/
```

- 推到 `main` 后，`.github/workflows/pages.yml` 自动构建并发布到 https://jangchubgyaltsen.github.io/kepan-app/
  （第一次要在仓库 Settings → Pages 里把 Source 设为「GitHub Actions」）。
- 学习记录、导入的书都存在手机本地（IndexedDB），不上传；设置里可以导出 / 导入备份。
- 复习排程用 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)（MIT）：「记得」= Good，「模糊」= Again，
  记忆保持率默认 90%（设置里 80–95%），答错的题在本轮最后再问一次。
- `data/` 里的内置书（含释义）会随网站公开发布。
- `sw.js` 预先缓存应用和内置书，转换模块和字体第一次用到时缓存；每次构建会换版本号，旧缓存自动清掉。

## 每日提醒（`push/`）

网页应用自己没法定时叫醒手机，提醒要靠一个很小的推送服务：`push/` 是一个 Cloudflare Worker（免费额度足够），
保存每台手机的推送订阅和提醒时间，每 5 分钟检查一次，到点就发一条不带内容的推送；
手机上的应用收到后自己算出「今天还有几条要复习」再弹通知，所以服务端不保存任何学习记录。

架设（一次性，在电脑上）：

```bash
cd push
npx wrangler login
npx wrangler d1 create kepan-push            # 把输出的 database_id 填进 wrangler.toml
npx wrangler d1 execute kepan-push --remote --file=schema.sql
node keygen.mjs                              # 公钥填进 wrangler.toml 的 VAPID_PUBLIC
npx wrangler secret put VAPID_PRIVATE_JWK    # 粘贴 keygen 输出的私钥
npx wrangler deploy                          # 得到 https://kepan-push.<你的子域>.workers.dev
```

然后在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 新建 `PUSH_SERVER`，
值为上面的 Worker 地址，重新运行一次「发布网页应用」。

手机端：

- iPhone / iPad 要 iOS 16.4 以上，并且先用 Safari「分享 → 添加到主屏幕」，从主屏幕打开后才能开提醒（苹果的限制）。
- 安卓 Chrome 直接在设置里打开「每日提醒」即可。
- 没有架推送服务时，设置里的「加到手机日历」会下载一个每天重复的日历提醒，作为替代。
