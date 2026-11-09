"""造一套演示用的小科判和讲记（内容虚构，只为演示程序界面和批注效果）。
用法: python make_demo.py 输出文件夹
"""
import os, sys
import docx
from docx.shared import Pt
from docx.oxml.ns import qn

out = sys.argv[1] if len(sys.argv) > 1 else 'demo'
os.makedirs(out, exist_ok=True)


def font(run, name, size=12):
    run.font.name = name; run.font.size = Pt(size)
    run._element.rPr.rFonts.set(qn('w:eastAsia'), name)


# 科判
k = docx.Document()
font(k.add_paragraph().add_run('示例论 科判'), '宋体', 16)
k.add_paragraph('表1：（1表） 全论')
t = k.add_table(rows=6, cols=4); t.style = 'Table Grid'
rows = [('甲一、初善序分分二', '乙一、顶礼', '顶礼本师释迦牟尼佛，恭敬三宝大悲尊，'),
        (None, '乙二、立誓', '我今如理略宣说，愿诸有缘生欢喜。'),
        ('甲二、中善正宗分分三', '乙一、观察人身难得', '暇满人身极难得，得已当知如意宝，'),
        (None, '乙二、观察寿命无常', '寿命无常如露电，死期不定莫放逸，'),
        (None, '乙四、观察因果不虚', '善恶业果终不虚，取舍应当细思维。'),
        ('甲三、后善结文', '', '以此善根尽回向，愿诸众生成菩提。')]
merge = {0: (0, 1), 2: (2, 4)}
t.cell(0, 0).merge(t.cell(5, 0)).text = '全论分三'
for r, (a, b, c) in enumerate(rows):
    if a:
        span = merge.get(r)
        cell = t.cell(r, 1).merge(t.cell(span[1], 1)) if span else t.cell(r, 1)
        cell.text = a
    if b:
        t.cell(r, 2).text = b
    else:
        t.cell(r, 1).merge(t.cell(r, 2))
    t.cell(r, 3).text = c
k.save(os.path.join(out, '示例论 科判 1稿1.docx'))

# 讲记
j = docx.Document()
def head(text):
    font(j.add_paragraph().add_run(text), '黑体', 14)
def body(text):
    font(j.add_paragraph().add_run(text), '宋体', 12)
head('全论分三：初善序分；中善正宗分；后善结文。')
head('甲一、初善序分分二：顶礼；立誓。')
head('乙一、顶礼')
body('顶礼本师释迦牟尼佛，恭敬三宝大悲尊，')
body('这是造论者首先礼敬本师和三宝。')
head('乙二、立誓')
body('我今如理略宣说，愿诸有缘生欢喜。')
head('甲二、中善正宗分分二：观察人身难得；观察寿命无常。')
head('乙一、观察人身难得')
body('暇满人身极难得，得已当知如意宝，')
body('暇满人身非常难得，得到以后要知道它像如意宝一样珍贵。')
head('乙二、观察寿命无常')
body('寿命无常如露电，死期不定勿放逸，')
body('寿命就像露水和闪电一样无常。')
head('乙三、观察因果不虚')
body('善恶业果终不虚，取舍应当细思维。')
head('甲三、后善结文')
body('以此善根尽回向，愿诸众生成菩提。')
j.save(os.path.join(out, '示例论.docx'))
print('ok')
