const api = require('../../utils/api');

const SECTOR_MAP = {
  hotel:   '酒店板块',
  taxfree: '免税板块',
  gold:    '黄金珠宝板块',
  dining:  '餐饮茶饮板块',
  cbec:    '跨境电商板块'
};

Page({
  data: {
    sectorKey: '',
    sectorName: '',
    categories: [],
    currentCat: '',
    indicators: [],
    loading: true,
    err: '',
    _byCat: {}
  },

  onLoad(opts) {
    const key = opts.sector || 'hotel';
    this.setData({ sectorKey: key, sectorName: SECTOR_MAP[key] || key });
    wx.setNavigationBarTitle({ title: SECTOR_MAP[key] || '板块数据' });
    this.refresh();
  },

  onPullDownRefresh() { this.refresh().then(() => wx.stopPullDownRefresh()); },

  async refresh() {
    this.setData({ loading: true, err: '' });
    try {
      const r = await api.dataset(this.data.sectorKey);
      const byCat = r.data || {};
      const categories = Object.keys(byCat);
      const currentCat = this.data.currentCat && categories.includes(this.data.currentCat)
        ? this.data.currentCat
        : (categories[0] || '');
      this._byCat = byCat;
      this.setData({
        categories,
        currentCat,
        indicators: currentCat ? byCat[currentCat] : [],
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false, err: String(e.message || e) });
    }
  },

  switchCat(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ currentCat: cat, indicators: this._byCat[cat] || [] });
  }
});
