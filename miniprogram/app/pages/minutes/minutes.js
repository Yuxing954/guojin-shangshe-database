const api = require('../../utils/api');
const favorites = require('../../utils/favorites');

Page({
  data: {
    list: [],
    shown: [],
    keyword: '',
    loading: true,
    err: '',
    favKeys: {},
    signedIn: false
  },

  onLoad() { this.refresh(); },
  onShow() { this.checkSession(); },
  onPullDownRefresh() { this.refresh().then(() => wx.stopPullDownRefresh()); },

  async checkSession() {
    try {
      const session = await favorites.ensureSession();
      this.setData({ signedIn: !!session });
      if (session) this.loadFavoriteKeys();
    } catch (e) {
      this.setData({ signedIn: false });
    }
  },

  async loadFavoriteKeys() {
    const r = await favorites.list('minute');
    if (r.error || !Array.isArray(r.data)) return;
    const favKeys = {};
    r.data.forEach(x => { favKeys[x.ref_key] = true; });
    this.setData({ favKeys });
  },

  async refresh() {
    this.setData({ loading: true, err: '' });
    try {
      const r = await api.dataset('minutes');
      const list = (r.data || []).map(x => Object.assign({}, x, { favKey: favorites.refKeyOf('minute', x) }));
      this.applyFilter(this.data.keyword, list);
      this.setData({ list, loading: false });
    } catch (e) {
      this.setData({ loading: false, err: String(e.message || e) });
    }
  },

  onSearch(e) {
    const kw = (e.detail.value || '').trim();
    this.setData({ keyword: kw });
    this.applyFilter(kw, this.data.list);
  },

  applyFilter(kw, list) {
    if (!kw) { this.setData({ shown: list }); return; }
    this.setData({
      shown: list.filter(x =>
        (x.title || '').indexOf(kw) > -1 || (x.sector || '').indexOf(kw) > -1 ||
        (x.stocks || '').indexOf(kw) > -1 || (x.summary || '').indexOf(kw) > -1
      )
    });
  },

  async onToggleFav(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = this.data.shown[idx];
    if (!item) return;
    if (!this.data.signedIn) {
      wx.showToast({ title: '请先在「我的」页登录', icon: 'none' });
      return;
    }
    const r = await favorites.toggle('minute', item);
    if (r.error) {
      if (r.error !== 'not-signed-in') { wx.showToast({ title: r.error, icon: 'none' }); return; }
      wx.showToast({ title: '请先在「我的」页登录', icon: 'none' });
      return;
    }
    const key = favorites.refKeyOf('minute', item);
    const favKeys = Object.assign({}, this.data.favKeys);
    if (r.added) { favKeys[key] = true; wx.showToast({ title: '已收藏', icon: 'success' }); }
    else { delete favKeys[key]; wx.showToast({ title: '已取消', icon: 'none' }); }
    this.setData({ favKeys });
  },

  copyDownload(e) {
    const link = e.currentTarget.dataset.link;
    if (!link) {
      wx.showToast({ title: '暂无下载链接', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({ title: '下载链接已复制', icon: 'success' })
    });
  }
});
