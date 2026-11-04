const storage = require('../../utils/storage');
const sessionContext = require('../../utils/sessionContext');
const ocrCache = require('../../utils/ocrCache');
const { formatShortDate } = require('../../utils/text');
const { track } = require('../../utils/metrics');

Page({
  data: {
    records: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const source = storage.getRecords();
    const records = source.map((record, index) => {
      const previous = source[index + 1];
      let deltaText = '';
      let deltaClass = '';
      if (
        previous &&
        typeof record.score === 'number' &&
        typeof previous.score === 'number'
      ) {
        const delta = record.score - previous.score;
        if (delta !== 0) {
          deltaText = delta > 0 ? `+${delta}` : `${delta}`;
          deltaClass = delta > 0 ? 'up' : 'down';
        }
      }

      return {
        id: record.id,
        scoreText: record.score === null || record.score === undefined ? '--' : `${record.score}%`,
        level: record.level || '',
        summary: record.summary || '',
        dateText: formatShortDate(record.createdAt),
        deltaText,
        deltaClass
      };
    });

    this.setData({ records });
    track('history_view', { count: records.length });
  },

  openRecord(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/result/result?id=${id}` });
  },

  removeRecord(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#E85A8C',
      success: (res) => {
        if (!res.confirm) return;
        storage.removeRecord(id);
        sessionContext.remove(id);
        this.refresh();
      }
    });
  },

  clearAll() {
    wx.showModal({
      title: '清空全部记录？',
      content: '所有本地分析结果都会被删除，无法恢复。',
      confirmText: '清空',
      confirmColor: '#E85A8C',
      success: (res) => {
        if (!res.confirm) return;
        storage.clearRecords();
        sessionContext.clear();
        ocrCache.clear();
        this.refresh();
        track('history_clear');
      }
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
