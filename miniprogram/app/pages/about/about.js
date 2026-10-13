const api = require('../../utils/api');

Page({
  data: {
    manifest: null,
    datasets: [],
    ghRepo: 'https://github.com/Yuxing954/guojin-shangshe-database',
    checkTime: ''
  },

  onShow() { this.refresh(); },

  async refresh() {
    try {
      const [mf, ds] = await Promise.all([
        api.manifest().catch(() => null),
        api.fetchDatasets ? api.fetchDatasets() : Promise.resolve(null)
      ]);
      this.setData({
        manifest: mf ? mf.manifest : null,
        checkTime: new Date().toLocaleString('zh-CN')
      });
    } catch (e) {
      this.setData({ checkTime: new Date().toLocaleString('zh-CN') });
    }
  },

  copyRepo() {
    wx.setClipboardData({
      data: this.data.ghRepo,
      success: () => wx.showToast({ title: '仓库地址已复制', icon: 'success' })
    });
  },

  copyOnline() {
    wx.setClipboardData({
      data: 'https://yuxing954.github.io/guojin-shangshe-database/',
      success: () => wx.showToast({ title: '线上地址已复制', icon: 'success' })
    });
  }
});
