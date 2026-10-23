#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""英语课文 PDF → txt 转换工具
用法: python3 tools/pdf2txt.py 课文1.pdf [课文2.pdf ...]
规则: PDF 有文字层 → 直接提取；扫描版（图片）→ 自动 OCR（需已安装 rapidocr）。
输出: 与 PDF 同名的 .txt 文件（UTF-8）。
"""
import glob
import os
import subprocess
import sys
import tempfile


def ascii_letters(s):
    return sum(1 for c in s if c.isascii() and c.isalpha())


def pdftotext_layer(pdf):
    """有文字层则返回文本，否则 None"""
    try:
        out = subprocess.run(
            ["pdftotext", pdf, "-"],
            capture_output=True, text=True, timeout=120,
        ).stdout
    except Exception:
        return None
    return out if ascii_letters(out) >= 50 else None


def ocr_pdf(pdf):
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:
        sys.exit(
            "本 PDF 是扫描版，需要 OCR 组件。请先执行一次：\n"
            "  pip3 install --user --break-system-packages rapidocr-onnxruntime\n"
            "然后重新运行本工具。"
        )
    engine = RapidOCR()
    lines = []
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(
            ["pdftoppm", "-png", "-r", "200", pdf, os.path.join(td, "p")],
            check=True, timeout=900,
        )
        imgs = sorted(glob.glob(os.path.join(td, "p-*.png")))
        print(f"OCR 识别 {len(imgs)} 页 …", flush=True)
        for n, img in enumerate(imgs, 1):
            res, _ = engine(img)
            if not res:
                continue
            res.sort(key=lambda r: (min(p[1] for p in r[0]), min(p[0] for p in r[0])))
            lines.extend(r[1].strip() for r in res)
            print(f"  第 {n}/{len(imgs)} 页", flush=True)
    return "\n".join(lines)


def clean(text):
    """去掉页眉页脚页码等噪音"""
    keep = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s:
            keep.append("")
            continue
        if s.isdigit() and len(s) <= 3:
            continue
        if ("出版社" in s and len(s) < 20) or s in ("外语教学与研究出版社", "外研社"):
            continue
        if len(s) <= 4 and not any(c.isascii() and c.isalpha() for c in s):
            continue
        keep.append(s)
    out = "\n".join(keep)
    while "\n\n\n" in out:
        out = out.replace("\n\n\n", "\n\n")
    return out.strip() + "\n"


def convert(pdf):
    print(f"== {os.path.basename(pdf)} ==", flush=True)
    text = pdftotext_layer(pdf)
    how = "文字层"
    if text is None:
        text = ocr_pdf(pdf)
        how = "OCR"
    out = os.path.splitext(pdf)[0] + ".txt"
    with open(out, "w", encoding="utf-8") as f:
        f.write(clean(text))
    print(f"完成（{how}）→ {out}\n", flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for p in sys.argv[1:]:
        convert(p)
