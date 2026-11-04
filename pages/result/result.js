const storage = require('../../utils/storage');
const sessionContext = require('../../utils/sessionContext');
const followupStore = require('../../utils/followupStore');
const { track } = require('../../utils/metrics');
const { formatDate } = require('../../utils/text');
const { STAGE_GUIDE } = require('../../data/love-framework');
const { QUICK_QUESTIONS } = require('../../data/followup');

function wrapText(ctx, text, maxWidth) {
  const chars = (text || '').split('');
  const lines = [];
  let line = '';
  chars.forEach((char) => {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

Page({
  data: {
    record: null,
    result: null,
    notFound: false,
    createdAtText: '',
    dimensionTitle: '心动五维',
    dimensionSub: '按书中的吸引力框架拆解，权重合计 100%',
    stageFocus: '',
    safetyFlagged: false,
    signalFilter: 'all',
    signalList: [],
    quickQuestions: QUICK_QUESTIONS,
    feedback: ''
  },

  onLoad(options) {
    if (!options || !options.id || options.from === 'timeline') {
      // 朋友圈等入口可能不带 id，统一回首页，避免出现空白结果页。
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    const record = storage.getRecord(options.id);
    if (!record) {
      this.setData({ notFound: true });
      return;
    }

    const result = record.result || {};
    const safetyFlagged = !!(result.safety && result.safety.flagged);

    this.setData({
      record,
      result,
      safetyFlagged,
      createdAtText: formatDate(record.createdAt),
      dimensionTitle: '心动五维',
      dimensionSub: '按书中的吸引力框架拆解，权重合计 100%',
      stageFocus: STAGE_GUIDE[record.stage] || '',
      feedback: record.feedback || ''
    }, () => {
      this.applySignalFilter('all');
      track('result_view', { score: result.score, flagged: safetyFlagged });
    });

    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    }
  },

  applySignalFilter(filter) {
    const signals = (this.data.result && this.data.result.signals) || [];
    const signalList = filter === 'all'
      ? signals
      : signals.filter((signal) => signal.type === filter);
    this.setData({ signalFilter: filter, signalList });
  },

  changeFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    if (!filter) return;
    this.applySignalFilter(filter);
  },

  startFollowUp(e) {
    const id = this.data.record && this.data.record.id;
    if (!id) return;
    const question = (e && e.currentTarget && e.currentTarget.dataset.question) || '';
    const base = `/pages/followup/followup?id=${encodeURIComponent(id)}`;
    wx.navigateTo({
      url: question ? `${base}&q=${encodeURIComponent(question)}` : base
    });
  },

  submitFeedback(e) {
    const value = e.currentTarget.dataset.value;
    if (!value) return;
    storage.updateRecord(this.data.record.id, { feedback: value });
    this.setData({ feedback: value });
    track('feedback', { value });
    wx.showToast({ title: '谢谢你的反馈', icon: 'none' });
  },

  retest() {
    const pages = getCurrentPages();
    const previous = pages.length > 1 ? pages[pages.length - 2] : null;
    if (previous && previous.route === 'pages/analyze/analyze') {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.redirectTo({ url: '/pages/analyze/analyze' });
  },

  deleteRecord() {
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复，聊天原文从未保存。',
      confirmText: '删除',
      confirmColor: '#E85A8C',
      success: (res) => {
        if (!res.confirm) return;
        storage.removeRecord(this.data.record.id);
        sessionContext.remove(this.data.record.id);
        followupStore.remove(this.data.record.id);
        track('record_delete');
        wx.navigateBack({ delta: 1 });
      }
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  drawPoster(canvas, result, record) {
    const dpr = wx.getSystemInfoSync().pixelRatio || 1;
    const W = 750;
    const H = 1130;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFF1F5');
    bg.addColorStop(0.58, '#FFF8F6');
    bg.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255, 182, 193, 0.30)';
    ctx.beginPath();
    ctx.arc(660, 40, 190, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 224, 200, 0.45)';
    ctx.beginPath();
    ctx.arc(70, 1010, 190, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#C6A0AE';
    ctx.font = '22px sans-serif';
    ctx.fillText('CHAT INSIGHT', 60, 78);

    const score = result.score === null || result.score === undefined ? '--' : `${result.score}`;
    ctx.fillStyle = '#2B2B2B';
    ctx.font = 'bold 150px sans-serif';
    ctx.fillText(score, 60, 282);
    const scoreWidth = ctx.measureText(score).width;

    ctx.fillStyle = '#E85A8C';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('%', 60 + scoreWidth + 10, 282);

    ctx.fillStyle = '#E85A8C';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(result.level || '', 60, 342);

    ctx.fillStyle = 'rgba(232, 90, 140, 0.16)';
    ctx.fillRect(60, 382, 630, 2);

    ctx.fillStyle = '#9A9A9A';
    ctx.font = '22px sans-serif';
    ctx.fillText('一句话结论', 60, 432);

    ctx.fillStyle = '#3A3A3A';
    ctx.font = '31px sans-serif';
    const lines = wrapText(ctx, result.summary || '', 630);
    lines.slice(0, 3).forEach((line, index) => {
      ctx.fillText(line, 60, 484 + index * 46);
    });

    ctx.fillStyle = '#9A9A9A';
    ctx.font = '22px sans-serif';
    ctx.fillText('心动五维', 60, 592);

    let y = 638;
    (result.dimensions || []).slice(0, 5).forEach((dimension) => {
      ctx.fillStyle = '#4A4A4A';
      ctx.font = '23px sans-serif';
      ctx.fillText(dimension.label, 60, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#E85A8C';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`${dimension.score}`, 690, y);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#F6E9EE';
      ctx.fillRect(60, y + 13, 630, 7);
      ctx.fillStyle = '#FF8EB4';
      ctx.fillRect(60, y + 13, 630 * Math.max(0, Math.min(100, dimension.score)) / 100, 7);

      y += 72;
    });

    ctx.fillStyle = '#B5B5B5';
    ctx.font = '21px sans-serif';
    ctx.fillText('基于这段对话的分析 · 仅供娱乐参考', 60, 1034);

    ctx.fillStyle = '#E85A8C';
    ctx.font = 'bold 23px sans-serif';
    ctx.fillText('微信搜索：心动分析', 60, 1078);
  },

  savePoster() {
    if (this._posterSaving) return;
    if (this.data.safetyFlagged || !this.data.result) {
      wx.showToast({ title: '这条结果暂不支持生成海报', icon: 'none' });
      return;
    }

    this._posterSaving = true;
    this.createSelectorQuery()
      .select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res && res[0];
        if (!item || !item.node) {
          this._posterSaving = false;
          wx.showToast({ title: '海报生成失败', icon: 'none' });
          return;
        }

        this.drawPoster(item.node, this.data.result, this.data.record);

        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvas: item.node,
            fileType: 'png',
            quality: 1,
            success: (file) => {
              wx.saveImageToPhotosAlbum({
                filePath: file.tempFilePath,
                success: () => {
                  track('poster_save');
                  wx.showToast({ title: '已保存到相册', icon: 'success' });
                },
                fail: (err) => {
                  const message = (err && err.errMsg) || '';
                  if (message.indexOf('auth') !== -1 || message.indexOf('authorize') !== -1) {
                    wx.showModal({
                      title: '需要相册权限',
                      content: '请在设置中允许保存图片到相册。',
                      confirmText: '去设置',
                      success: (result) => {
                        if (result.confirm) wx.openSetting();
                      }
                    });
                  } else {
                    wx.showToast({ title: '保存失败，请重试', icon: 'none' });
                  }
                },
                complete: () => {
                  this._posterSaving = false;
                }
              });
            },
            fail: () => {
              this._posterSaving = false;
              wx.showToast({ title: '海报生成失败', icon: 'none' });
            }
          });
        }, 60);
      });
  },

  onShareAppMessage() {
    const result = this.data.result || {};
    const isFlagged = result.safety && result.safety.flagged;
    if (isFlagged) {
      return { title: '读懂聊天里的心动信号', path: '/pages/index/index' };
    }
    const title = typeof result.score === 'number'
      ? `我的心动指数 ${result.score}%，你也来测测？`
      : '读懂聊天里的心动信号';
    return { title, path: '/pages/index/index' };
  },

  onShareTimeline() {
    const result = this.data.result || {};
    const title = result.safety && result.safety.flagged
      ? '读懂聊天里的心动信号'
      : typeof result.score === 'number'
        ? `我的心动指数 ${result.score}%，你也来测测？`
        : '读懂聊天里的心动信号';
    // 不携带记录 id，接收方打开后回到首页。
    return { title, query: 'from=timeline' };
  }
});
