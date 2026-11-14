"""把打包时自动截的两张窗口图和 Word 批注图拼成一张「使用图示.png」
用法: python make_guide.py 截图文件夹 输出.png [字体文件]
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

D, OUT = sys.argv[1], sys.argv[2]
FONTS = sys.argv[3:] + ['C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/simhei.ttf',
                        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc']
F = next(p for p in FONTS if os.path.isfile(p))
f = lambda s: ImageFont.truetype(F, s)
W, RED, pad = 1300, (214, 40, 40), 30
s1 = Image.open(os.path.join(D, '1-选好文件.png')).convert('RGB').crop((10, 0, 762, 598))
s2 = Image.open(os.path.join(D, '2-校对完成.png')).convert('RGB').crop((10, 0, 762, 598))
w = Image.open(os.path.join(D, '3-word批注.png')).convert('RGB').crop((120, 180, 1275, 1150))


def wrap(text, width, size=24):
    lines, cur = [], ''
    for ch in text:
        if f(size).getlength(cur + ch) > width:
            lines.append(cur); cur = ch
        else:
            cur += ch
    lines.append(cur)
    return lines


def mark(d, xy, label=None, side='right'):
    d.rounded_rectangle(xy, radius=6, outline=RED, width=4)
    if label:
        r = 17
        x = xy[2] + 6 if side == 'right' else xy[0] - 2 * r - 6
        y = (xy[1] + xy[3]) // 2 - r
        if side == 'below':
            x, y = (xy[0] + xy[2]) // 2 - r, xy[3] + 4
        d.ellipse((x, y, x + 2 * r, y + 2 * r), fill=RED)
        d.text((x + r, y + r), label, fill='white', font=f(22), anchor='mm')


def side(title, notes, img, marks):
    im = img.copy(); d = ImageDraw.Draw(im)
    for m in marks:
        mark(d, *m)
    tw = W - im.width - 3 * pad
    lines = []
    for n in notes:
        lines += wrap(n, tw) + ['']
    h = max(im.height, len(lines) * 34) + 2 * pad + 60
    out = Image.new('RGB', (W, h), 'white'); dd = ImageDraw.Draw(out)
    dd.text((pad, pad), title, fill=(30, 30, 30), font=f(34))
    out.paste(im, (pad, pad + 60))
    dd.rectangle((pad - 1, pad + 59, pad + im.width, pad + 60 + im.height), outline=(180, 180, 180))
    y = pad + 70
    for ln in lines:
        dd.text((im.width + 2 * pad, y), ln, fill=(40, 40, 40), font=f(24)); y += 34
    return out


a = side('第一步  打开程序，选文件', [
    '① 点「选择…」选要校对的科判 Word。',
    '② 讲记（可选）：选好科判后，程序会按文件名在同一文件夹里自动找讲记填上；不对可以重新选。Word、PDF 都可以。',
    '③ 繁体版科判（可选）：有繁体版就选上，会逐格和简体版对照。',
    '④ 结果存到：默认是桌面上的「科判校对结果」文件夹，没有会自动建。想换地方点「更改…」，下次打开会记住。',
    '⑤ 点「开始校对」。'], s1,
    [((664, 54, 748, 78), '1', 'left'), ((664, 82, 748, 106), '2', 'left'), ((664, 110, 748, 134), '3', 'left'),
     ((664, 136, 748, 160), '4', 'left'), ((12, 172, 90, 196), '5', 'below')])
b = side('第二步  等它跑完', [
    '框里会显示进度和结果：几条「请确认」、几条「请看一下」。',
    '结果另存为「原文件名 校对月日时分.docx」，放在「结果存到」那个文件夹。原稿不会改动。',
    '⑥ 点「打开校对结果」，直接用 Word 打开。',
    '⑦ 点「打开结果文件夹」，看以前所有的校对结果。'], s2,
    [((14, 376, 700, 428), None), ((96, 172, 180, 196), '6', 'below'), ((186, 172, 280, 196), '7', 'below')])
ws = w.resize((int(w.width * 1.08), int(w.height * 1.08)))
notes = ['每个问题挂在对应的格子上，右边是批注内容：',
         '【请确认】多半是真错。比如这里「中善正宗分分三」底下是乙一、乙二、乙四，跳了乙三；讲记却写「分二」。',
         '【请看一下】要人判断。比如科判写「莫放逸」，讲记写「勿放逸」。',
         '【仅供参考】可以不理。',
         '最上面那条是总表：各类条数，以及讲记本身的问题（只提醒，不标在科判上）。看完在原稿上改即可。',
         '（图中用的是演示文件，内容是虚构的。）']
lines = []
for n in notes:
    lines += wrap(n, W - 2 * pad)
h = pad + 60 + ws.height + 20 + len(lines) * 36 + pad
c = Image.new('RGB', (W, h), 'white'); d = ImageDraw.Draw(c)
d.text((pad, pad), '第三步  在 Word 里看批注', fill=(30, 30, 30), font=f(34))
c.paste(ws, (pad, pad + 60))
d.rectangle((pad - 1, pad + 59, pad + ws.width, pad + 60 + ws.height), outline=(180, 180, 180))
y = pad + 60 + ws.height + 20
for ln in lines:
    d.text((pad, y), ln, fill=(40, 40, 40), font=f(24)); y += 36
top = Image.new('RGB', (W, 110), 'white'); d = ImageDraw.Draw(top)
d.text((30, 25), '科判校对（第一版）使用图示', fill=(20, 20, 20), font=f(42))
d.text((32, 78), 'Windows 上双击 kepan-jiaodui.exe 打开。程序只按规则比对，不用 AI，也不联网。', fill=(90, 90, 90), font=f(22))
parts = [top, a, b, c]
out = Image.new('RGB', (W, sum(p.height for p in parts) + 60), 'white'); y = 0
for p in parts:
    out.paste(p, (0, y)); y += p.height
    ImageDraw.Draw(out).line((30, y + 10, W - 30, y + 10), fill=(220, 220, 220), width=2); y += 20
out.save(OUT)
print(out.size)
