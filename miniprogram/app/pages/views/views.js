const api = require('../../utils/api');
const favorites = require('../../utils/favorites');
const { cloud } = require('../../utils/cloud');

Page({
  data: {
    tab: 'views', // views=商社精选 | allviews=全部
    list: [],
    shown: [],
    keyword: '',
    page: 0,
    PAGE_SIZE: 20,
    total: 0,
    coverageTo: '',
    loading: true,
    err: '',
    favKeys: {},      // 已收藏 ref_key 集合
    signedIn: false
  },

  onLoad() { this.refresh(); },
  onShow() { this.checkSession(); },
  onPullDownRefresh() { this.refresh().then(() => wx.stopPullDownRefresh()); },
  onReachBottom() {
    if (this.data.shown.length < this.data.list.length) {
      this.loadMore();
    }
  },

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
    const r = await favorites.list('view');
    if (r.error || !Array.isArray(r.data)) return;
    const favKeys = {};
    r.data.forEach(x => { favKeys[x.ref_key] = true; });
    this.setData({ favKeys });
  },

  async refresh() {
    this.setData({ loading: true, err: '', page: 0 });
    try {
      const r = await api.dataset(this.data.tab);
      const list = (r.data || []).map(x => Object.assign({}, x, { favKey: favorites.refKeyOf('view', x) }));
      const cov = (r.coverageTo || '').slice(0, 16);
      this.setData({
        list,
        total: list.length,
        coverageTo: cov,
        shown: list.slice(0, this.data.PAGE_SIZE),
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false, err: String(e.message || e) });
    }
  },

  loadMore() {
    const p = this.data.page + 1;
    const end = (p + 1) * this.data.PAGE_SIZE;
    this.setData({ page: p, shown: this.data.list.slice(0, end) });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab, keyword: '' });
    this.refresh();
  },

  onSearch(e) {
    const kw = (e.detail.value || '').trim();
    this.setData({ keyword: kw });
    if (!kw) {
      this.setData({ shown: this.data.list.slice(0, this.data.PAGE_SIZE), page: 0, total: this.data.list.length });
      return;
    }
    const filtered = this.data.list.filter(x =>
      (x.title || '').indexOf(kw) > -1 || (x.body || '').indexOf(kw) > -1 ||
      (x.author || '').indexOf(kw) > -1 || (x.topic || '').indexOf(kw) > -1
    );
    this.setData({ shown: filtered, page: 0, total: filtered.length });
  },

  clearSearch() {
    this.setData({ keyword: '' });
    this.setData({ shown: this.data.list.slice(0, this.data.PAGE_SIZE), page: 0, total: this.data.list.length });
  },

  // 收藏/取消收藏（云端同步，跨设备）
  async onToggleFav(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = this.data.shown[idx];
    if (!item) return;
    if (!this.data.signedIn) {
      wx.showToast({ title: '请先在「我的」页登录', icon: 'none' });
      return;
    }
    const r = await favorites.toggle('view', item);
    if (r.error) {
      if (r.error !== 'not-signed-in') { wx.showToast({ title: r.error, icon: 'none' }); return; }
      wx.showToast({ title: '请先在「我的」页登录', icon: 'none' });
      return;
    }
    const key = favorites.refKeyOf('view', item);
    const favKeys = Object.assign({}, this.data.favKeys);
    if (r.added) { favKeys[key] = true; wx.showToast({ title: '已收藏', icon: 'success' }); }
    else { delete favKeys[key]; wx.showToast({ title: '已取消', icon: 'none' }); }
    this.setData({ favKeys });
  },

  copyLink(e) {
    const link = e.currentTarget.dataset.link;
    if (!link) return;
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({ title: '原文链接已复制', icon: 'success' })
    });
  }
});
