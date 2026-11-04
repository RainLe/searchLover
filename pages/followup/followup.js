const towxml = require('../../towxml/index');
const storage = require('../../utils/storage');
const sessionContext = require('../../utils/sessionContext');
const followupStore = require('../../utils/followupStore');
const { followUp, abort } = require('../../services/analyze');
const { track } = require('../../utils/metrics');
const { QUICK_QUESTIONS } = require('../../data/followup');

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

Page({
  data: {
    record: null,
    notFound: false,
    messages: [],
    followUpText: '',
    isReplying: false,
    scrollIntoId: '',
    quickQuestions: QUICK_QUESTIONS
  },

  onLoad(options) {
    const id = options && options.id;
    const record = id ? storage.getRecord(id) : null;
    if (!record) {
      this.setData({ notFound: true });
      return;
    }

    const initial = options.q ? safeDecode(options.q).trim() : '';
    this.setData({
      record,
      messages: followupStore.get(id)
    }, () => {
      this.scrollToBottom();
      if (initial) this.sendFollowUp(initial);
    });
  },

  onUnload() {
    this._unloaded = true;
    abort();
  },

  scrollToBottom() {
    // scroll-into-view 的值不变时不会重新触发，先清空再设置。
    this.setData({ scrollIntoId: '' }, () => {
      this.setData({ scrollIntoId: 'chat-bottom' });
    });
  },

  onFollowUpInput(e) {
    this.setData({ followUpText: e.detail.value });
  },

  tapQuick(e) {
    const question = e.currentTarget.dataset.question;
    if (question) this.sendFollowUp(question);
  },

  sendFollowUp(input) {
    const question = typeof input === 'string'
      ? input.trim()
      : (this.data.followUpText || '').trim();
    if (!question || this.data.isReplying || !this.data.record) return;

    const recordId = this.data.record.id;
    const history = this.data.messages.map((message) => ({
      role: message.role,
      content: message.content
    }));

    const messages = this.data.messages.concat([{
      id: `u-${Date.now()}`,
      role: 'user',
      content: question
    }]);

    followupStore.set(recordId, messages);
    this.setData({ messages, followUpText: '', isReplying: true }, () => {
      this.scrollToBottom();
    });
    track('followup_send', { chars: question.length });

    followUp({
      record: this.data.record,
      question,
      history,
      context: sessionContext.get(recordId)
    }).then((text) => {
      if (this._unloaded || !text) return;
      let nodes = null;
      try {
        nodes = towxml(text, 'markdown', {});
      } catch (e) {
        // 渲染失败时回退成纯文本，不让追问结果丢失。
        nodes = null;
      }
      const next = this.data.messages.concat([{
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: text,
        nodes
      }]);
      followupStore.set(recordId, next);
      this.setData({ messages: next, isReplying: false }, () => {
        this.scrollToBottom();
      });
      track('followup_success');
    }).catch((err) => {
      if (this._unloaded || err.code === 'ABORTED') return;
      this.setData({ isReplying: false });
      track('followup_fail', { code: err.code || 'UNKNOWN' });
      if (err.code === 'CONFIG') {
        wx.showModal({ title: '未配置密钥', content: err.message, showCancel: false });
        return;
      }
      wx.showToast({ title: '没想出答案，再试一次', icon: 'none' });
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
