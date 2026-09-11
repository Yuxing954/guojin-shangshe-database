# -*- coding: utf-8 -*-
"""知识星球文本清洗工具（zsxq_update.py 与 fix_market_view.py 共用）"""
import re
import urllib.parse


def clean_markup(s: str) -> str:
    """把知识星球富文本标签转成可读文本
    <e type="hashtag" title="%23XXX%23" /> -> #XXX#
    <e type="web" href="..." /> -> title 或解码后的链接
    """
    def repl(m):
        attrs = m.group(0)
        t = re.search(r'title="([^"]*)"', attrs)
        h = re.search(r'href="([^"]*)"', attrs)
        if t and urllib.parse.unquote(t.group(1)).strip():
            return urllib.parse.unquote(t.group(1))
        if h:
            return urllib.parse.unquote(h.group(1))
        return ''

    s = re.sub(r'<e\s[^>]*?/>', repl, s)          # 自闭合 <e ... />
    s = re.sub(r'<e\s[^>]*?>.*?</e>', repl, s)     # 成对 <e ...>...</e>
    s = re.sub(r'</?e[^>]*>', '', s)               # 兜底
    for a, b in (('&nbsp;', ' '), ('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&quot;', '"')):
        s = s.replace(a, b)
    return s


# 知识星球自动附加的水印/来源标注（富文本标签清洗后会残留成文本）
WATERMARK_PATTERNS = [
    r'知识星球[-—\s]*安全中心',
    r'知识星球官方[-—\s]*安全中心',
    r'来自知识星球',
    r'知识星球APP',
]
_WATERMARK_RE = re.compile('|'.join(WATERMARK_PATTERNS))


def strip_watermark(s: str) -> str:
    """移除平台自动附加的水印/来源标注行"""
    lines = []
    for ln in s.split('\n'):
        cleaned = _WATERMARK_RE.sub('', ln).strip()
        # 整行只有水印的（清洗后为空）直接丢弃
        if ln.strip() and not cleaned:
            continue
        lines.append(re.sub(r'\s{2,}', ' ', cleaned) if cleaned != ln.strip() else ln)
    return '\n'.join(lines)


def normalize_content(s: str) -> str:
    """清洗标签 + 去水印 + 折叠连续重复行 + 规整多余空行"""
    s = strip_watermark(clean_markup(s or ''))
    out = []
    for ln in [l.rstrip() for l in s.split('\n')]:
        if out and ln.strip() and ln.strip() == out[-1].strip():
            continue
        out.append(ln)
    s = re.sub(r'\n{3,}', '\n\n', '\n'.join(out))
    return s.strip()


def make_title(content: str, limit: int = 30) -> str:
    """标题取内容首行（去 markdown # 前缀），超长截断"""
    for ln in (content or '').split('\n'):
        t = ln.strip().lstrip('#').strip()
        if t:
            return t[:limit] + ('…' if len(t) > limit else '')
    return ''
