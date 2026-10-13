const api = require('../../utils/api');

Page({
  data: {
    list: [],
    shown: [],
    keyword: '',
    loading: true,
    err: ''
  },

  onLoad() { this.refresh(); },
  onPullDownRefresh() { this.refresh().then(() => wx.stopPullDownRefresh()); },

  async refresh() {
    this.setData({ loading: true, err: '' });
    try {
      const r = await api.dataset('minutes');
      const list = r.data || [];
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
