const api = require('../../utils/api');

const SECTORS = [
  { key: 'hotel',   name: '酒店',     icon: '🏨' },
  { key: 'taxfree', name: '免税',     icon: '🛍' },
  { key: 'gold',    name: '黄金珠宝', icon: '💎' },
  { key: 'dining',  name: '餐饮茶饮', icon: '🍜' },
  { key: 'cbec',    name: '跨境电商', icon: '📦' }
];

Page({
  data: {
    manifest: null,
    sectors: SECTORS,
    valuation: [],
    topMovers: [],
    latestMinutes: [],
    loading: true,
    err: ''
  },

  onLoad() { this.refresh(); },
  // 下拉刷新走 fresh=1：直拉 GitHub 上游，仓库刚 push 也能立刻拿到
  onPullDownRefresh() { this.refresh(true).then(() => wx.stopPullDownRefresh()); },

  async refresh(fresh) {
    this.setData({ loading: true, err: '' });
    try {
      const [mf, val, weekly, minutes] = await Promise.all([
        api.manifest().catch(() => null),
        api.dataset('valuation', fresh).catch(() => null),
        api.dataset('weekly', fresh).catch(() => null),
        api.dataset('minutes', fresh).catch(() => null)
      ]);
      const valuation = (val && val.data) || [];
      const weeklyArr = (weekly && weekly.data) || [];
      const minutesArr = (minutes && minutes.data) || [];
      const movers = weeklyArr.filter(x => x.chg !== null).sort((a, b) => b.chg - a.chg);
      this.setData({
        manifest: mf ? mf.manifest : null,
        valuation,
        topMovers: [...movers.slice(0, 5), ...movers.slice(-3).reverse()],
        latestMinutes: minutesArr.slice(0, 3),
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false, err: String(e.message || e) });
    }
  },

  goSector(e) {
    const key = e.currentTarget.dataset.key;
    wx.navigateTo({ url: '/pages/sector/sector?sector=' + key });
  },

  copyLink() {
    wx.setClipboardData({
      data: 'https://github.com/Yuxing954/guojin-shangshe-database',
      success: () => wx.showToast({ title: '仓库地址已复制', icon: 'success' })
    });
  }
});
