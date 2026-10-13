// WorkBuddy 云服务客户端（微信小程序形态）
// 数据面与数据代理同域：https://guojin-shangshe-api.app.workbuddy.host
// publicConfig 来源于 workbuddy_cloud_service 激活结果（复用应用 wbapp_M3YLOTvPPYw6Ca4KUG5TNc）
const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics');

const publicConfig = {
  resourceId: 'wbcs_okvKda6U0Jjw7srHCRamlu',
  endpoint: 'https://guojin-shangshe-api.app.workbuddy.host',
  publishableKey: 'wbpk_M3YLOTvPPYw6Ca4KUG5TNc_eUQT7dipa8ssmdq0yTIE7QNvY88PFb3I'
};

const cloud = createMiniProgramWorkBuddyCloud({
  endpoint: publicConfig.endpoint,
  publishableKey: publicConfig.publishableKey,
  wx: createDiagnosticWx(wx)
});

module.exports = { cloud, publicConfig };
