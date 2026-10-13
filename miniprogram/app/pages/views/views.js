const api = require('../../utils/api');

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
    err: ''
  },

  onLoad() { this.refresh(); },
  onPullDownRefresh() { this.refresh().then(() => wx.stopPullDownRefresh()); },
  onReachBottom() {
    if (this.data.shown.length < this.data.list.length) {
      this.loadMore();
    }
  },

  async refresh() {
    this.setData({ loading: true, err: '', page: 0 });
    try {
      const r = await api.dataset(this.data.tab);
      const list = r.data || [];
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

  copyLink(e) {
    const link = e.currentTarget.dataset.link;
    if (!link) return;
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({ title: '原文链接已复制', icon: 'success' })
    });
  }
});
