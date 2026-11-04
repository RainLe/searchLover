const storage = require('../../utils/storage');
const sessionContext = require('../../utils/sessionContext');
const ocrCache = require('../../utils/ocrCache');
const { track } = require('../../utils/metrics');

Page({
  data: {
    count: 0
  },

  onShow() {
    this.setData({ count: storage.getRecords().length });
  },

  clearAll() {
    wx.showModal({
      title: '清除本地数据？',
      content: '所有分析记录都会被删除，无法恢复。',
      confirmText: '清除',
      confirmColor: '#E85A8C',
      success: (res) => {
        if (!res.confirm) return;
        storage.clearRecords();
        sessionContext.clear();
        ocrCache.clear();
        this.setData({ count: 0 });
        track('privacy_clear');
        wx.showToast({ title: '已清除', icon: 'none' });
      }
    });
  }
});
