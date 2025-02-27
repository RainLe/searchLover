// app.js
App({
  onLaunch() {
    // 小程序初始化时执行
    console.log('小程序启动');
  },
  onShow() {
    // 小程序启动或从后台进入前台时执行
    console.log('小程序显示');
  },
  onHide() {
    // 小程序从前台进入后台时执行
    console.log('小程序隐藏');
  },
  globalData: {
    // 全局变量
    userInfo: null,
    apiBaseUrl: 'https://your-server-url.com' // 替换为你的服务器地址
  }
});