"""Conservative candidate scope; editorial review is still required."""
import re
SECTORS={
 '酒店旅游':('酒店','旅游','景区','免签','华住','锦江','首旅','亚朵','携程','同程','祥源','峨眉山','九华'),
 '免税':('免税','中免','海旅'),
 '餐饮茶饮':('餐饮','茶饮','海底捞','九毛九','太二','小菜园','绿茶','百胜','蜜雪','古茗','茶百道','沪上阿姨','瑞幸','星巴克'),
 '黄金珠宝':('珠宝','老铺黄金','周大福','周大生','老凤祥','潮宏基','金六福'),
 '零售与消费出海':('零售','电商','商超','泡泡玛特','名创优品','永辉','东百','飞亚达','小商品城','安克','赛维','阿里巴巴','京东','拼多多'),
 '教育人服':('教育','新东方','好未来','东方甄选','科德','传智','人力资源','人服','科锐','北京人力')}
EXCLUDE=re.compile(r'白酒|酒企|茅台|五粮液|乳制品|调味品|食品饮料|食饮周观点|食品周报|医药|医疗|药店|GPU|半导体|造纸|轻工.*周')
def sector_for(title,body=''):
 # Research team names do not determine sector; remove bracketed broker headings.
 subject=re.sub(r'【[^】]*(?:食饮|传媒|轻工|商社|消费)[^】]*】','',title)
 if EXCLUDE.search(subject):return None
 for sector,terms in SECTORS.items():
  if any(t in subject for t in terms):return sector
 return None
