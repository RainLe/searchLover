const { track } = require('../../utils/metrics');

Component({
  properties: {
    reply: {
      type: Object,
      value: { tone: '', text: '' }
    }
  },

  methods: {
    copyText() {
      const text = this.data.reply && this.data.reply.text;
      if (!text) return;
      wx.setClipboardData({
        data: text,
        success: () => {
          track('reply_copy', { tone: this.data.reply.tone });
          wx.showToast({ title: '已复制，去发送吧', icon: 'none' });
        }
      });
    }
  }
});
