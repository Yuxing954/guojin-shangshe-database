// API 基地址：云端代理（实时拉 GitHub 仓库数据，仓库更新→小程序自动跟随）
const API_BASE = 'https://guojin-shangshe-api.app.workbuddy.host';

function req(path, fresh) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + path + (fresh ? (path.indexOf('?') > -1 ? '&' : '?') + 'fresh=1' : ''),
      method: 'GET',
      timeout: 30000, // fresh=1 直拉上游 GitHub，放宽到 30s
      success: (r) => {
        if (r.data && r.data.ok) resolve(r.data);
        else reject(new Error((r.data && r.data.error) || '数据服务异常'));
      },
      fail: (e) => reject(new Error('网络请求失败：' + (e.errMsg || '')))
    });
  });
}

module.exports = {
  API_BASE,
  manifest: () => req('/manifest'),
  dataset: (k, fresh) => req('/data/' + k, fresh),
  // 数值格式化
  fmtChg: (v) => (v === null || v === undefined || isNaN(v)) ? '--' : (v > 0 ? '+' + v.toFixed(2) : v.toFixed(2)),
  fmtNum: (v, d) => (v === null || v === undefined || isNaN(v)) ? '--' : Number(v).toFixed(d === undefined ? 2 : d),
  // 涨红跌绿（CN 配色约定）
  chgColor: (v) => (v === null || v === undefined || isNaN(v) || v === 0) ? '#5a5a52' : (v > 0 ? '#c0392b' : '#1e8449')
};
