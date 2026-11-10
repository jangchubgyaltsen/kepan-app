# 界面原型

`kepan-ui.html` 是科判查看器的单文件交互原型，浏览器直接打开即可。右侧面板是还在调的选项，已确认的数值写在面板的说明里。

内嵌了《入行论》第一、二品的科判、颂词和善说海释义，用来演示阅读页点颂词看释义。

## 导入流程（首页右上「＋」）

原型里的转换是模拟的，数据取自入行论的真实转换结果。接进 app 时按 `web/convert/` 的接口对应：

| 界面步骤 | 调用 |
| --- | --- |
| 选文件 | 科判 PDF 必选，讲记 epub 可选 |
| 转换 | `kepanFromPdf(pdf, { id, fixes, onProgress })`，有 epub 再调 `shiyiFromEpub(epub, tree)`。`onLog` 收到「正在加载运行环境…」时显示不确定进度条，之后按页显示 |
| 给已有的书加讲记 | 第一步切到「给已有的书加讲记」（或书卡 ⋯ 里的「加讲记 / 换讲记」）：选书架上的一本书和讲记 epub，不用再选 PDF。取这本书已存的科判树，只调 `shiyiFromEpub(epub, tree)`，核对一步相同，最后一步填讲记名称 |
| 核对 | 列出 `suggestions`，三类默认「用讲记」，每条可改「保持科判」。`report` 里的其余差异只作提示 |
| 书名 | 用户填全称和简称，存为 `meta.name`、`meta.shortName`；简称用 `meta.title` 第一个空格前的部分预填 |
| 加入书架 | `applyFixes(tree, 选中的 fix)`；勘误 = 上次的勘误 + 选中的 fix + 未选的 `{...fix, skip: true}`，随书保存，下次导入作为 `fixes` 传入 |

书的 `id` 由 app 对 `meta.title` 算短哈希得到，不让用户填。
