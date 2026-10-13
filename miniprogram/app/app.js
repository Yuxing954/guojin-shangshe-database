App({
  onLaunch() {
    // 云客户端已在 utils/cloud.js 完成初始化（createMiniProgramWorkBuddyCloud）
    // 启动时预热登录态，各页面 onShow 自行 checkSession
    try {
      require('./utils/cloud');
    } catch (e) {
      console.error('[WorkBuddy Cloud] init failed', JSON.stringify({ stage: 'app-launch', message: e instanceof Error ? e.message : 'cloud init failed' }));
    }
  }
});
