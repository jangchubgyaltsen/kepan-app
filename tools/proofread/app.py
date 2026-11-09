"""科判校对 —— 给师父用的小窗口。
选科判 Word（必选）、讲记（可选）、繁体版科判（可选），点「开始校对」，
在科判旁边另存一份「…校对MMDDHHMM.docx」，问题都写在 Word 批注里，原稿不动。
"""
import os, re, sys, threading, traceback
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

VERSION = '第一版'


def guess_partners(kpath):
    """按文件名猜讲记和繁体版：「X 科判 1稿4.docx」→「X.docx」「X 科判 1稿4 繁体.docx」"""
    folder, name = os.path.split(kpath)
    stem = os.path.splitext(name)[0]
    jj = ft = None
    m = re.match(r'^(.*?)\s*科判', stem)
    if m:
        base = m.group(1).strip()
        for ext in ('.docx', '.pdf'):
            for cand in (base, base.split(' ')[0]):
                p = os.path.join(folder, cand + ext)
                if os.path.isfile(p):
                    jj = jj or p
        if not jj:   # 如「117格言宝藏论释(上).docx」
            cands = sorted(f for f in os.listdir(folder or '.') if f.startswith(base) and '科判' not in f
                           and f.lower().endswith(('.docx', '.pdf')) and '繁体' not in f)
            if cands:
                jj = os.path.join(folder, cands[0])
    p = os.path.join(folder, stem + ' 繁体.docx')
    if os.path.isfile(p) and not stem.endswith('繁体'):
        ft = p
    return jj, ft


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f'科判校对（{VERSION}）')
        self.geometry('760x520')
        self.out = None
        self.vars = {k: tk.StringVar() for k in ('kp', 'jj', 'ft')}
        frm = ttk.Frame(self, padding=12)
        frm.pack(fill='both', expand=True)
        rows = [('kp', '科判 Word（必选）', [('Word 文件', '*.docx')]),
                ('jj', '讲记（可选，Word 或 PDF）', [('Word 或 PDF', '*.docx *.pdf')]),
                ('ft', '繁体版科判（可选）', [('Word 文件', '*.docx')])]
        for r, (key, label, types) in enumerate(rows):
            ttk.Label(frm, text=label).grid(row=r, column=0, sticky='w', pady=4)
            ttk.Entry(frm, textvariable=self.vars[key], width=60).grid(row=r, column=1, sticky='we', padx=6)
            ttk.Button(frm, text='选择…', command=lambda k=key, t=types: self.pick(k, t)).grid(row=r, column=2)
        frm.columnconfigure(1, weight=1)
        bar = ttk.Frame(frm)
        bar.grid(row=3, column=0, columnspan=3, sticky='we', pady=(10, 6))
        self.go = ttk.Button(bar, text='开始校对', command=self.start)
        self.go.pack(side='left')
        self.open_btn = ttk.Button(bar, text='打开校对结果', command=self.open_out, state='disabled')
        self.open_btn.pack(side='left', padx=8)
        self.log = tk.Text(frm, height=18, wrap='char')
        self.log.grid(row=4, column=0, columnspan=3, sticky='nsew')
        frm.rowconfigure(4, weight=1)
        self.say('说明：程序只按规则比对，不用 AI。结果另存一份新的 Word，问题写在批注里，原稿不会改动。\n'
                 '批注分三种：「请确认」多半是真错；「请看一下」要人判断；「仅供参考」可以不理。\n'
                 '只关讲记本身的问题，不标在科判上，列在文档开头那条总批注的最后。\n')

    def pick(self, key, types):
        p = filedialog.askopenfilename(filetypes=types + [('所有文件', '*.*')])
        if not p:
            return
        self.vars[key].set(p)
        if key == 'kp':
            jj, ft = guess_partners(p)
            if jj and not self.vars['jj'].get():
                self.vars['jj'].set(jj)
                self.say(f'自动找到讲记：{os.path.basename(jj)}（不对的话可以重新选）')
            if ft and not self.vars['ft'].get():
                self.vars['ft'].set(ft)
                self.say(f'自动找到繁体版：{os.path.basename(ft)}（不需要可以清空）')

    def say(self, text):
        self.log.insert('end', text + '\n')
        self.log.see('end')

    def start(self):
        kp = self.vars['kp'].get().strip()
        if not kp or not os.path.isfile(kp):
            messagebox.showwarning('科判校对', '请先选择科判 Word 文件')
            return
        jj = self.vars['jj'].get().strip() or None
        ft = self.vars['ft'].get().strip() or None
        for p in (jj, ft):
            if p and not os.path.isfile(p):
                messagebox.showwarning('科判校对', f'找不到文件：{p}')
                return
        self.go.config(state='disabled')
        self.open_btn.config(state='disabled')
        self.say('\n开始：' + os.path.basename(kp))
        threading.Thread(target=self.work, args=(kp, jj, ft), daemon=True).start()

    def work(self, kp, jj, ft):
        try:
            from annotate import annotate
            out, r, fj = annotate(kp, jj, ft, log=lambda t: self.after(0, self.say, t))
            self.out = out
            hi = sum(1 for i in r['main'] if i['level'] == '高')
            mid = sum(1 for i in r['main'] if i['level'] == '中')
            lo = sum(1 for i in r['main'] if i['level'] == '低')
            msg = f'请确认 {hi} 条，请看一下 {mid} 条，仅供参考 {lo} 条'
            if ft:
                msg += f'，繁简对照 {len(fj)} 条'
            if r['remind']:
                msg += f'；讲记本身的提醒 {len(r["remind"])} 条'
            self.after(0, self.done, out, msg)
        except Exception:
            err = traceback.format_exc()
            self.after(0, self.fail, err)

    def done(self, out, msg):
        self.say(msg)
        self.say('结果：' + out)
        self.go.config(state='normal')
        self.open_btn.config(state='normal')

    def fail(self, err):
        self.say('出错了，请把下面这段发给做程序的人：\n' + err)
        self.go.config(state='normal')
        messagebox.showerror('科判校对', '校对时出错，详情见窗口里的文字')

    def open_out(self):
        if self.out and os.path.isfile(self.out):
            if sys.platform.startswith('win'):
                os.startfile(self.out)
            else:
                import subprocess
                subprocess.Popen(['xdg-open' if sys.platform.startswith('linux') else 'open', self.out])


def selftest():
    """打包后自检：各模块能否载入，结果写到 exe 旁边的 selftest.txt"""
    out = os.path.join(os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__)), 'selftest.txt')
    try:
        import annotate, fjcheck, kpcheck, pdfplumber, opencc, docx   # noqa
        assert opencc.OpenCC('t2s').convert('歸依') == '归依'
        msg = 'ok'
    except Exception:
        msg = traceback.format_exc()
    with open(out, 'w', encoding='utf-8') as f:
        f.write(msg)


def demo(kp, jj, outdir):
    """演示：自动填好文件、截图、开始校对、完成后再截图，然后退出（打包时生成使用图示用）"""
    from PIL import ImageGrab
    app = App()
    app.geometry('760x520+40+40')
    app.vars['kp'].set(kp)
    jj2, ft = guess_partners(kp)
    app.vars['jj'].set(jj or jj2 or '')
    app.say(f'自动找到讲记：{os.path.basename(jj or jj2)}（不对的话可以重新选）')

    def shot(name):
        app.update(); app.lift(); app.attributes('-topmost', True); app.update()
        x, y = app.winfo_rootx(), app.winfo_rooty()
        w, h = app.winfo_width(), app.winfo_height()
        ImageGrab.grab(bbox=(x - 10, y - 40, x + w + 10, y + h + 10)).save(os.path.join(outdir, name))

    def step1():
        shot('1-选好文件.png')
        app.start()
        app.after(500, wait)

    def wait():
        if str(app.go['state']) == 'disabled':
            app.after(500, wait)
        else:
            shot('2-校对完成.png')
            app.destroy()
    app.after(1500, step1)
    app.mainloop()


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest()
    elif '--demo' in sys.argv:
        a = sys.argv[sys.argv.index('--demo') + 1:]
        demo(a[0], a[1] if len(a) > 2 else None, a[-1])
    else:
        App().mainloop()
