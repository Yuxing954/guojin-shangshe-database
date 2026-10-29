"""Conservative candidate scope; editorial review is still required."""
import re
SECTORS={
 '酒店旅游':('酒店','旅游','文旅','游轮','邮轮','冰雪大世界','雪假','景区','免签','华住','锦江','首旅','亚朵','携程','同程','祥源','丽江股份','峨眉山','九华','冬航季','航季时刻','机场','客运航班','出入境'),
 '免税':('免税','中免','海旅'),
 '餐饮茶饮':('餐饮','茶饮','海底捞','九毛九','太二','小菜园','绿茶','百胜','蜜雪','古茗','茶百道','沪上阿姨','瑞幸','星巴克'),
 '黄金珠宝':('珠宝','老铺黄金','周大福','周大生','老凤祥','潮宏基','金六福'),
 '零售与消费出海':('零售','社零','社会消费品','商超','万辰集团','零食量贩','量贩零食','泡泡玛特','名创优品','永辉','东百','飞亚达','小商品城','布鲁可','潮玩动漫','拼搭玩具','乐高','LVMH','奢侈品','化妆品','美妆','美护','润本股份','珀莱雅','毛戈平','上美股份','上海家化','贝泰妮','巨子生物','爱美客','华熙生物','丸美生物','林清轩','水羊股份','福瑞达','锦波生物','思摩尔','中烟香港','烟草','电子烟','361度'),
 '教育人服':('教育','新东方','好未来','科德','传智','人力资源','人服','科锐','北京人力')}
EXCLUDE=re.compile(r'白酒|酒企|茅台|五粮液|乳制品|调味品|食品饮料|食饮周观点|食品周报|代糖需求|保龄宝|医药|医疗|药店|GPU|半导体|造纸|轻工.*周|消费建材|建材建筑')
ECOMMERCE=re.compile(r'东方甄选|美团|阿里巴巴|淘天|淘宝|天猫|京东|拼多多|唯品会|跨境电商|安克|赛维|华凯易佰|吉宏|致欧|SHEIN|Temu|Amazon|亚马逊',re.I)
RETAIL_CHANNEL_EXCEPTIONS=('泡泡玛特','名创优品','永辉','中免','老铺黄金','周大福')
def is_ecommerce_topic(title):
 # A beauty-brand/channel tracker is not a platform-industry investment view.
 subject=re.sub(r'【[^】]*】','',title).strip()
 if re.match(r'(?:美护|美妆|化妆品).*双11.*(?:抖音|天猫).*数据跟踪',subject):return False
 if ECOMMERCE.search(title):return True
 return '电商' in title and not any(x in title for x in RETAIL_CHANNEL_EXCEPTIONS)

def title_for(title,body=''):
 # Incremental CSV titles may be shortened; the stored body's first line is intact.
 if re.search(r'(?:\.{3}|…)$',title.strip()):
  first=next((x.strip() for x in body.splitlines() if x.strip()),'')
  if '\n' in title and title.splitlines()[0].strip()==first:return first
  prefix=re.sub(r'(?:\.{3}|…)$','',title.strip())
  if first.startswith(prefix):return first
 return title

def published_for(row):return row.get('原始发布时间') or row.get('时间')

def substantive_segment(title,body):
 # A concise company event can carry more information than a long invitation.
 text=body.strip()
 return len(text)>=80 or (len(text)>=40 and bool(sector_for(title,body)) and bool(re.search(r'\d+(?:\.\d+)?\s*(?:%|亿|万|家|港元|美元|元)',text)) and bool(re.search(r'减持|增持|回购|经营|收入|利润|门店|GMV',text,re.I)))

def sector_for(title,body=''):
 # Research team names do not determine sector; remove bracketed broker headings.
 subject=re.sub(r'【[^】]*(?:食饮|传媒|轻工|商社|消费|纺织服装珠宝|纺服)[^】]*】','',title_for(title,body))
 if EXCLUDE.search(subject) or is_ecommerce_topic(subject) or re.search(r'航空照明|航空航天|航空发动机|航材制造',subject):return None
 # Component/contract electronics manufacturing is outside consumer operations.
 if '盈趣科技' in subject:return None
 if '力盛体育' in subject:return '酒店旅游'
 if '运动服饰行业' in subject:return '零售与消费出海'
 if re.search(r'天目湖|三特索道|宋城演艺|李宁|报喜鸟|CTE(?:潮玩|玩具)展',subject):return '酒店旅游' if re.search(r'天目湖|三特索道|宋城演艺',subject) else '零售与消费出海'
 if re.search(r'航空[:：].*航司控班保价',subject):return '酒店旅游'
 # Geographic fieldwork can have a generic title; require explicit duty-free
 # business in the body rather than matching incidental sector mentions broadly.
 if re.search(r'海南.*(?:调研|渠道|反馈)',subject) and re.search(r'离岛免税|免税|中免',body):return '免税'
 if '商社板块' in subject and re.search(r'教育|酒店|免税|餐饮|零售',body):return '商社综合'
 if re.match(r'周末好.*推荐标的',subject) and sum(x in body for x in ('行动教育','百胜中国','周大福','名创优品','东百集团'))>=3:return '商社综合'
 if re.match(r'周观点[:：].*比音勒芬',subject) and re.search(r'安踏.*特步',body):return '零售与消费出海'
 if re.match(r'双11大促跟踪',subject) and sum(x in body for x in ('珀莱雅','毛戈平','上海家化','润本','玉泽','佰草集'))>=3:return '零售与消费出海'
 if re.search(r'航司.*(?:供需|经营数据|客座率|客运|运力)',subject):return '酒店旅游'
 if re.search(r'航空.*(?:经营数据|客座率|客运|运力)',subject):return '酒店旅游'
 if '六福集团' in subject:return '黄金珠宝'
 if re.search(r'IQOS|ZYN|菲利普莫里斯|安踏体育|特步|欧莱雅',subject,re.I):return '零售与消费出海'
 for sector,terms in SECTORS.items():
  if any(t in subject for t in terms):return sector
 return None






