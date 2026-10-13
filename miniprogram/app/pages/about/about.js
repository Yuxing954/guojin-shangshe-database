const api = require('../../utils/api');
const favorites = require('../../utils/favorites');
const { cloud } = require('../../utils/cloud');

Page({
  data: {
    manifest: null,
    datasets: [],
    ghRepo: 'https://github.com/Yuxing954/guojin-shangshe-database',
    checkTime: '',
    user: null,
    loginMsg: '',
    favList: [],
    favLoading: false,
    favErr: ''
  },

  onShow() { this.refresh(); this.checkSession(); },

  async checkSession() {
    try {
      const { data: session, error } = await cloud.auth.getSession();
      if (error || !session) { this.setData({ user: null }); return; }
      this.setData({ user: session.user || null });
      this.loadFavorites();
    } catch (e) {
      this.setData({ user: null });
    }
  },

  // 微信登录：wx.login → signInWithWechat(code, appid)
  onLogin() {
    this.setData({ loginMsg: '' });
    wx.login({
      success: async (res) => {
        try {
          const appid = wx.getAccountInfoSync().miniProgram.appId;
          const { data: session, error } = await cloud.auth.signInWithWechat(res.code, appid);
          if (error) {
            this.setData({ loginMsg: friendlyAuth(error) });
            console.error('[WorkBuddy Cloud] login failed', JSON.stringify({ stage: 'wechat-login-handler', message: error.message || '微信登录失败' }));
            return;
          }
          this.setData({ user: (session && session.user) || null, loginMsg: '' });
          this.loadFavorites();
        } catch (error) {
          console.error('[WorkBuddy Cloud] login failed', JSON.stringify({ stage: 'wechat-login-handler', message: error instanceof Error ? error.message : '微信登录失败' }));
          this.setData({ loginMsg: '微信登录失败，请重试' });
        }
      },
      fail: (error) => {
        console.error('[WorkBuddy Cloud] login failed', JSON.stringify({ stage: 'wx.login', message: error.errMsg }));
        this.setData({ loginMsg: '微信登录失败：' + (error.errMsg || '') });
      }
    });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后云端收藏仍保留，重新登录即可恢复。',
      success: async (r) => {
        if (!r.confirm) return;
        const { error } = await cloud.auth.signOut();
        if (error) { this.setData({ loginMsg: friendlyAuth(error) }); return; }
        this.setData({ user: null, favList: [], favErr: '' });
      }
    });
  },

  async loadFavorites() {
    if (!this.data.user) return;
    this.setData({ favLoading: true, favErr: '' });
    const r = await favorites.list('view');
    const r2 = await favorites.list('minute');
    if (r.error || r2.error) {
      const msg = (r.error && r.error !== 'not-signed-in') ? r.error : ((r2.error && r2.error !== 'not-signed-in') ? r2.error : '');
      if (msg) { this.setData({ favLoading: false, favErr: msg }); return; }
      this.setData({ favLoading: false, favErr: '' });
      return;
    }
    const views = (r.data || []).map(x => Object.assign({}, x, { type: '观点' }));
    const minutes = (r2.data || []).map(x => Object.assign({}, x, { type: '纪要' }));
    this.setData({ favList: views.concat(minutes), favLoading: false });
  },

  copyFavLink(e) {
    const link = e.currentTarget.dataset.link;
    if (!link) { wx.showToast({ title: '该收藏无链接', icon: 'none' }); return; }
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
    });
  },

  async removeFav(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = this.data.favList[idx];
    if (!item) return;
    const r = await favorites.toggle(item.kind, item);
    if (r.error && r.error !== 'not-signed-in') { wx.showToast({ title: r.error, icon: 'none' }); return; }
    if (r.removed) {
      const favList = this.data.favList.filter((_, i) => i !== idx);
      this.setData({ favList });
      wx.showToast({ title: '已移除', icon: 'none' });
    }
  },

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

function friendlyAuth(error) {
  const kind = error && error.kind;
  if (kind === 'network' || kind === 'backend-unavailable') return '网络暂不可用，请稍后重试';
  if (kind === 'unauthenticated' || kind === 'invalid_grant') return '登录已过期，请重新登录';
  return (error && error.message) || '登录失败，请重试';
}
