// 轻量埋点。当前只在控制台输出；正式上线后在微信后台配置事件，
// 把 ENABLE_REPORT 改为 true 即可接 wx.reportEvent。
const ENABLE_REPORT = false;

function track(name, data) {
  console.log('[metric]', name, data || {});
  if (!ENABLE_REPORT) return;
  if (typeof wx !== 'undefined' && typeof wx.reportEvent === 'function') {
    try {
      wx.reportEvent(name, data || {});
    } catch (e) {
      // 事件未在后台配置时会失败，忽略即可
    }
  }
}

module.exports = { track };
