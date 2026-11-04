const storage = require('../../utils/storage');
const { track } = require('../../utils/metrics');
const { formatShortDate } = require('../../utils/text');
const { pickRandom } = require('../../data/quotes');

Page({
  data: {
    hasHistory: false,
    latestScore: '',
    latestLevel: '',
    latestDate: '',
    quote: null
  },

  onShow() {
    const latest = storage.getLatest();
    this.setData({
      hasHistory: !!latest,
      latestScore: latest && latest.score !== null && latest.score !== undefined ? `${latest.score}%` : '--',
      latestLevel: latest ? latest.level || '' : '',
      latestDate: latest ? formatShortDate(latest.createdAt) : '',
      quote: pickRandom(this.data.quote)
    });
    track('home_view', { hasHistory: !!latest });
  },

  startAnalysis() {
    track('home_start');
    wx.navigateTo({ url: '/pages/analyze/analyze' });
  },

  openExample() {
    track('home_example');
    wx.navigateTo({ url: '/pages/analyze/analyze?example=1' });
  },

  openHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  onShareAppMessage() {
    return {
      title: '读懂聊天里的心动信号',
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    return { title: '读懂聊天里的心动信号' };
  }
});
