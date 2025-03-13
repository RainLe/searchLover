// index.js
Page({
  data: {
    invaidToday: false,
    welcomeText: '欢迎使用放假小程序',
  },

  // 跳转到上传页面
  navigateToUpload() {
    wx.navigateTo({
      url: '/pages/upload/upload'
    });
  },

  onLoad() {
    console.log('首页加载完成');
  }
});