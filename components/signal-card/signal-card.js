const { track } = require('../../utils/metrics');

Component({
  properties: {
    signal: {
      type: Object,
      value: { type: 'neutral', quote: '', explain: '' }
    }
  },

  methods: {
    copyQuote() {
      const quote = this.data.signal && this.data.signal.quote;
      if (!quote) return;
      wx.setClipboardData({
        data: quote,
        success: () => {
          track('quote_copy', { type: this.data.signal.type });
          wx.showToast({ title: '已复制原话', icon: 'none' });
        }
      });
    }
  }
});
