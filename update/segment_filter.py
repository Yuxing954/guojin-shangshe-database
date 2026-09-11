# -*- coding: utf-8 -*-
"""
知识星球主题「段子」判定器 v2

段子 = 有实质信息量的调研纪要 / 行业观点 / 数据点评短文（含快讯、汇总贴）。
非段子 = 运营通知、活动预告、抽奖签到、招聘、问卷、纯图片/纯文件贴、
         广告推广、打卡灌水、星球公告、纯链接等。

设计原则：宁可放过可疑，不可错杀干货。
  1) 占位内容 / 空内容 → 直接剔除
  2) 噪音词：仅当「内容不具实质分析性」时剔除（长文且有分析特征可豁免）
  3) 广告/通知：命中且无分析特征时才剔除
  4) 极短内容：含数字指标或分析特征词视为快讯保留，否则剔除

返回 (is_segment: bool, reason: str)
"""
import re

# ---------- 词汇表 ----------

# 标题噪音词（命中 + 内容不具实质 → 剔除）。注意：刻意不放「调查」「招聘」等
# 易误伤的泛词，避免「关于美301两项调查结果更新」这类干货被误杀。
NOISE_TITLE = ["抽奖", "签到", "打卡", "签到贴", "问卷调查", "征稿", "问卷填写",
               "转发抽", "限时活动", "入群", "加群", "星球公告", "重要通知",
               "会议通知", "直播预告", "开课通知", "报名链接", "招募令"]

# 运营/广告短语：命中且全文无分析特征时才剔除
AD_WORDS = ["扫码", "长按识别", "点击链接", "立即报名", "限时优惠", "折扣码",
            "免费领取", "领取资料", "加微信", "私信我", "商务合作",
            "关注公众号", "转发朋友圈", "求关注", "网盘", "提取码", "见附件"]

# 通知型开头
NOTICE_HEAD = ("今晚", "明晚", "预约直播", "直播", "路演预告", "重要通知",
               "星球公告", "公告：", "【通知】", "本星球")

# 分析/纪要特征词
ANALYSIS_KW = ["纪要", "调研", "点评", "观点", "更新", "数据", "跟踪", "发布",
               "同比", "环比", "增速", "业绩", "财报", "中报", "季报", "年报",
               "预计", "测算", "估值", "标的", "推荐", "建议", "看好", "超预期",
               "低于预期", "产能", "出货", "涨价", "价格", "库存", "需求", "供给",
               "订单", "政策", "市场规模", "市占率", "毛利", "净利", "营收",
               "客单价", "门店", "公司", "行业", "板块", "龙头", "产业链", "弹性",
               "逻辑", "催化", "利好", "风险", "配置", "关注", "核心", "要点",
               "增长", "下滑", "扩产", "投产", "中标", "签约", "合作", "突破"]

# 数字指标（快讯特征），如 53%、1.2 亿、+15pct
NUMERIC = re.compile(r'\d+(\.\d+)?\s*(%|％|亿|万|pct|bp|个百分点|倍|元|美元|亿元)')

# 占位内容（清洗后只剩「文件」「图片」等标记）
PLACEHOLDER = re.compile(r'^[「【\[（(]?\s*(文件|图片|视频|链接|语音|附件|文档|音频)\s*[」】\]）)]?$')

# 纯符号
ONLY_SYMBOL = re.compile(r'^[\s\W_·、。！？～…—\-@#*【】\[\]()（）<>《》"\'/+|]+$')

# 纯链接
ONLY_URL = re.compile(r'^(https?://\S+\s*)+$')

# 纯标签贴（清洗后只剩 #xxx# 之类）
ONLY_HASHTAG = re.compile(r'^(#[^#\s]{1,20}#\s*)+$')

# 仅会议/纪要标题（正文即标题，实质内容在附件里）：以会议类词收尾的短单行
MEETING_TITLE = re.compile(
    r'^[^\n]{3,35}[（(]?(交流会|业绩会|电话会|电话会议|发布会|说明会|路演|'
    r'调研纪要|会议纪要|专家交流|纪要|沙龙)[）)]?\s*[\d\.\-:：]*$')

MIN_LEN = 40       # 无任何分析特征时的最短可接受长度
HARD_SHORT = 15    # 低于此长度直接剔除
SUBSTANTIAL = 150  # 「实质内容」门槛：超过此长度且含分析特征，可豁免噪音词
PIC_TITLE_MAX = 45  # 「仅标题的图片贴」判定：单行且短于此长度 + 有图 → 剔除


def _has_analysis(text: str) -> bool:
    return any(k in text for k in ANALYSIS_KW) or bool(NUMERIC.search(text))


def classify(title: str, body: str, topic: dict | None = None) -> tuple[bool, str]:
    """返回 (是否段子, 剔除原因)"""
    t = (title or "").strip()
    b = (body or "").strip()
    full = f"{t}\n{b}"
    images = (topic or {}).get("images") or []
    files = (topic or {}).get("files") or []

    # 0) 空 / 占位 / 纯符号 / 纯链接 / 纯标签
    if not b:
        return False, "纯图片贴（无文字）" if images else "正文为空"
    if PLACEHOLDER.match(b):
        return False, "纯文件/图片占位"
    if ONLY_URL.match(b):
        return False, "纯链接贴"
    if ONLY_HASHTAG.match(b):
        return False, "纯标签贴"
    if ONLY_SYMBOL.match(b):
        return False, "纯符号内容"
    if len(b) < HARD_SHORT:
        return False, f"内容过短（{len(b)}字）"

    # 1) 仅标题的图片/文件贴：正文单行且短（内容实际在图/文件里）
    if images and len(b) <= PIC_TITLE_MAX and '\n' not in b:
        return False, "图片贴（仅标题文字）"

    # 1b) 仅会议/纪要标题（无正文内容，实质在附件）
    if '\n' not in b and MEETING_TITLE.match(b) and b.count('，') + b.count('。') == 0:
        return False, "仅会议标题（无正文）"

    has_ana = _has_analysis(full)
    substantial = len(b) >= SUBSTANTIAL and has_ana

    # 2) 标题噪音词（实质长文豁免）
    for w in NOISE_TITLE:
        if w in t and not substantial:
            return False, f"标题噪音词：{w}"

    # 3) 广告/运营词（有分析特征豁免）
    for w in AD_WORDS:
        if w in full and not has_ana:
            return False, f"广告/运营词：{w}"

    # 4) 纯通知贴（通知开头 + 无分析特征 + 偏短）
    if b.startswith(NOTICE_HEAD) and not has_ana and len(b) < 120:
        return False, "纯通知贴"

    # 5) 极短且无任何分析特征/数字 → 疑似灌水
    if len(b) < MIN_LEN and not has_ana:
        return False, f"内容过短且无信息量（{len(b)}字）"

    return True, ""
