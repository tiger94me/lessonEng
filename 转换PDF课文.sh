#!/usr/bin/env bash
# 双击/运行本脚本，把扫描版课文 PDF 转成 txt：./转换PDF课文.sh 课文.pdf
cd "$(dirname "$0")" && python3 tools/pdf2txt.py "$@"
