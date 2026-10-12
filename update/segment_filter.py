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

# 观点分类：食品饮料/大众品行业与公司研究归入“全部市场观点”。识别前先剥离
# 券商团队前缀，避免“【某某食饮】鸣鸣很忙/茶饮”等零售服务研究被误判。
FOOD_BEVERAGE_FOCUS = re.compile(
    r"食品饮料|食品行业|食品板块|食饮|食品|食饮周观点|食饮周报|食饮行业|食饮板块|食饮中期策略|"
    r"大众品|白酒|区域酒|高端酒|啤酒|黄酒|葡萄酒|酒类|酒企|乳业|乳制品|乳品|"
    r"调味品|饮料行业|饮料板块|饮料龙头|饮料包装|饮料|水饮行业|水饮板块|水饮渠道|酿酒行业|酿酒板块|"
    r"食品加工|休闲食品|方便食品|速冻食品|肉制品|烘焙|冻品|"
    r"粮油|预制菜|零食板块|零食行业|贵州茅台|五粮液|泸州老窖|山西汾酒|洋河股份|古井贡酒|"
    r"今世缘|青岛啤酒|燕京啤酒|重庆啤酒|伊利股份|蒙牛乳业|光明乳业|农夫山泉|东鹏饮料|"
    r"香飘飘|承德露露|百润股份|海天味业|千禾味业|天味食品|安井食品|宝立食品|桃李面包|"
    r"洽洽食品|盐津铺子|甘源食品|三全食品|惠泉啤酒|卫龙美味|劲仔食品|西麦食品|新乳业|"
    r"华润饮料|华润啤酒|舍得酒业|珍酒李渡|燕京啤酒|中炬高新|颐海国际|君乐宝|蒙牛|伊利|"
    r"妙可蓝多|立高食品|有友食品|莲花控股|统一企业中国|统一企业|海融科技|百威亚太|百威啤酒|"
    r"H&H国际控股|H&H国际|金徽酒|迎驾贡酒|古越龙山|老白干酒|千味央厨|鲟龙科技|涪陵榨菜|榨菜|"
    r"汤臣倍健|八马茶业|溜溜梅|会稽山|酒鬼酒|三元股份|周黑鸭|万洲国际|三全|双汇发展|绝味食品|西麦"
)

# 这些主体本质是餐饮服务、现制茶饮或食品零售渠道，仍属于商社研究覆盖。
# 例外只由标题中的明确零售/服务主题触发，不因正文顺带提到门店或零售而豁免。
RETAIL_SERVICE_FOCUS = re.compile(
    r"^(?:20\d{6}\s*)?(?:鸣鸣很忙|万辰集团|锅圈|来伊份|巴比食品|古茗|茶百道|奈雪的茶|蜜雪冰城|喜茶|零食量贩|量贩零食|零售变革|零售行业|零售专题|"
    r"零售渠道|零售业态|商超|超市|便利店|餐饮|餐饮链|餐饮行业|餐饮公司|餐饮上市公司|"
    r"餐饮供应链|现制茶饮|茶饮行业|茶饮品牌|火锅|酒店|旅游|免税|珠宝|社服)"
    r"|^20\d{6}当前位置持续重点推荐(?:万辰集团|鸣鸣很忙|锅圈)"
)
RETAIL_BRAND_FOCUS = re.compile(r"鸣鸣很忙|万辰集团|锅圈|古茗|茶百道|奈雪|蜜雪冰城|喜茶")

# 只去掉标题起始处的券商/研究团队标签；保留标题正文及其原始内容用于后续索引。
LEADING_TEAM_TAG = re.compile(r"^\s*[【\[<（(][^】\]>）)]{1,40}[】\]>）)]\s*")
LEADING_DECORATION_TAG = re.compile(r"^\s*[【\[](?:礼物|红包|太阳|玫瑰|烟花|笑脸|鲜花|咖啡|支持|喜报|加油|抱拳|握手|鼓掌|爱心|福)[】\]]\s*")
BROKER_TEAM_NAME = re.compile(
    r"国泰海通|建投|浙商|中金|华创|国金|国信|东吴|华泰|财通|申万|国盛|东财|开源|广发|招商|"
    r"中信|中泰|华福|天风|长江|华安|西部|信达|太平洋|东北|民生|兴业|东方|国联|国元|中银|"
    r"银河|中邮|光大|中原|国海|平安|瑞银|高盛|华西|国投|华鑫|华源"
)
FOOD_COMPANY_NAME = re.compile(
    r"贵州茅台|五粮液|泸州老窖|山西汾酒|洋河股份|古井贡酒|今世缘|青岛啤酒|燕京啤酒|重庆啤酒|"
    r"伊利股份|蒙牛乳业|光明乳业|农夫山泉|东鹏饮料|香飘飘|承德露露|百润股份|海天味业|千禾味业|"
    r"天味食品|安井食品|宝立食品|桃李面包|洽洽食品|盐津铺子|甘源食品|三全食品|惠泉啤酒|卫龙美味|"
    r"劲仔食品|西麦食品|新乳业|华润饮料|华润啤酒|舍得酒业|珍酒李渡|中炬高新|颐海国际|君乐宝|"
    r"妙可蓝多|立高食品|有友食品|莲花控股|统一企业中国|统一企业|海融科技|百威亚太|百威啤酒|"
    r"H&H国际控股|H&H国际|金徽酒|迎驾贡酒|古越龙山|老白干酒"
)
FOOD_TEAM_SIGNAL = re.compile(r"食饮|食品|大众品|白酒")
MIXED_TEAM_SIGNAL = re.compile(r"农业|新消费|社服")


def _classification_title(title: str) -> str:
    value = (title or "").strip()
    value = re.sub(r"^(?:[\U0001F300-\U0001FAFF]\ufe0f?\s*)+", "", value)
    while True:
        decoration = LEADING_DECORATION_TAG.match(value)
        if decoration:
            value = value[decoration.end():].lstrip()
            continue
        match = LEADING_TEAM_TAG.match(value)
        if not match:
            return value
        tag = match.group(0)
        if not BROKER_TEAM_NAME.search(tag) or FOOD_COMPANY_NAME.search(tag):
            return value
        value = value[match.end():].lstrip(" |｜:：-—")


def is_food_beverage_focus(title: str) -> bool:
    """食品饮料/大众品主题应归入市场观点；餐饮、茶饮和明确零售专题保留商社分类。"""
    subject = _classification_title(title)
    if RETAIL_SERVICE_FOCUS.search(subject) or RETAIL_BRAND_FOCUS.search(subject):
        return False
    # Use a clearly food-focused broker team prefix for generic sector reports whose
    # visible title omits the sector; mixed agriculture/consumer labels are ambiguous.
    tags = re.findall(r"[【\[]([^】\]]{1,60})[】\]]", (title or "")[:120])
    for tag in tags:
        if BROKER_TEAM_NAME.search(tag) and FOOD_TEAM_SIGNAL.search(tag) and not MIXED_TEAM_SIGNAL.search(tag):
            if re.search(r"餐饮链|餐饮供应链", subject) and not FOOD_BEVERAGE_FOCUS.search(subject):
                return False
            return True
    return bool(FOOD_BEVERAGE_FOCUS.search(subject))

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

# Event announcements (rather than research or meeting notes) are not market views.
EVENT_ANNOUNCEMENT = re.compile(
    r'(?:论坛年会|行业大会|峰会|研讨会).{0,24}(?:将于|定于).{0,24}(?:召开|举行|开幕)|'
    r'(?:财联社|新闻发布会).{0,40}(?:将于|定于).{0,24}(?:召开|举行|开幕)')

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

    if EVENT_ANNOUNCEMENT.search(f"{t}\n{b}"):
        return False, "活动通知/预告"

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
