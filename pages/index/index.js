// index.js
Page({
  data: {
    welcomeText: '欢迎使用情侣可能性分析小程序'
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