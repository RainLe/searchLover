const config = require('../../config/index');
const ocr = require('../../services/ocr');
const analyzeService = require('../../services/analyze');
const storage = require('../../utils/storage');
const sessionContext = require('../../utils/sessionContext');
const { maskPII } = require('../../utils/privacy');
const { truncateChat } = require('../../utils/text');
const { track } = require('../../utils/metrics');
const EXAMPLES = require('../../data/examples');

const LOADING_STEPS = [
  '整理聊天记录',
  '识别 TA 的回应信号',
  '对照心动五维',
  '生成行动建议'
];

Page({
  data: {
    mode: 'text',
    text: '',
    charCount: 0,
    maxChars: config.limits.maxInputChars,

    imageList: [],
    maxImages: config.ocr.maxImages,
    isRecognizing: false,
    ocrProgress: '',

    stages: config.stages,
    stage: '',
    showNames: false,
    myName: '',
    taName: '',

    isAnalyzing: false,
    loadingSteps: LOADING_STEPS,
    activeStep: 0,
    loadingHint: '',
    elapsed: 0,
    piiNote: '',

    errorMsg: ''
  },

  onLoad(options) {
    this._unloaded = false;
    this._imageSeq = 0;
    this._recognizing = false;
    this._requestSeq = 0;

    if (options && options.example) {
      this.fillExample(0);
      track('example_from_home');
      wx.showToast({ title: '示例已填入，点击开始分析', icon: 'none' });
    }
  },

  onUnload() {
    this._unloaded = true;
    this._recognizing = false;
    this.stopLoadingTimer();
    ocr.abortAll();
    analyzeService.abort();
  },

  /* ---------- 输入 ---------- */

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.mode) return;
    this.setData({ mode, errorMsg: '' });
    track('mode_switch', { mode });
  },

  onInput(e) {
    const text = e.detail.value;
    this.setData({
      text,
      charCount: text.length,
      errorMsg: ''
    });
  },

  clearText() {
    this.setData({ text: '', charCount: 0, errorMsg: '' });
  },

  chooseStage(e) {
    const label = e.currentTarget.dataset.label;
    this.setData({ stage: this.data.stage === label ? '' : label });
  },

  toggleNames() {
    this.setData({ showNames: !this.data.showNames });
  },

  onMyName(e) {
    this.setData({ myName: e.detail.value });
  },

  onTaName(e) {
    this.setData({ taName: e.detail.value });
  },

  fillExample(index) {
    const example = EXAMPLES[index];
    if (!example) return;
    this.setData({
      mode: 'text',
      text: example.text,
      charCount: example.text.length,
      stage: example.stage,
      errorMsg: ''
    });
    track('example_fill', { id: example.id });
  },

  /* ---------- 截图识别 ---------- */

  chooseChatImages() {
    const remaining = config.ocr.maxImages - this.data.imageList.length;
    if (remaining <= 0) {
      wx.showToast({ title: `最多上传 ${config.ocr.maxImages} 张截图`, icon: 'none' });
      return;
    }

    const handlePaths = (paths) => {
      if (!paths || !paths.length) return;
      this.addImages(paths.slice(0, remaining));
    };

    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({
        count: remaining,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => handlePaths(res.tempFiles.map((file) => file.tempFilePath)),
        fail: (err) => this.handleChooseFail(err)
      });
      return;
    }

    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => handlePaths(res.tempFilePaths),
      fail: (err) => this.handleChooseFail(err)
    });
  },

  handleChooseFail(err) {
    const errMsg = (err && err.errMsg) || '';
    if (errMsg.indexOf('cancel') !== -1) return;
    wx.showToast({ title: '图片选择失败', icon: 'none' });
    console.error('图片选择失败', err);
  },

  addImages(paths) {
    const startId = this._imageSeq || 0;
    const newItems = paths.map((path, index) => ({
      id: startId + index + 1,
      path,
      status: 'pending',
      text: '',
      error: ''
    }));
    this._imageSeq = startId + paths.length;

    this.setData({
      imageList: this.data.imageList.concat(newItems)
    }, () => {
      track('ocr_add', { count: paths.length });
      this.recognizePending();
    });
  },

  recognizePending() {
    if (this._recognizing || this._unloaded) return;
    this._recognizing = true;

    const next = () => {
      if (this._unloaded) {
        this._recognizing = false;
        return;
      }

      const imageList = this.data.imageList;
      const pendingIndex = imageList.findIndex((item) => item.status === 'pending');
      if (pendingIndex === -1) {
        this._recognizing = false;
        this.setData({ isRecognizing: false, ocrProgress: '' });
        return;
      }

      const pending = imageList[pendingIndex];
      this.setData({
        isRecognizing: true,
        ocrProgress: `识别中 ${pendingIndex + 1}/${imageList.length}`
      });
      this.setImageItem(pending.id, { status: 'uploading', error: '' });

      ocr.recognizeImage(pending.path).then((text) => {
        if (this._unloaded) {
          next();
          return;
        }
        if (this.data.imageList.some((item) => item.id === pending.id)) {
          this.setImageItem(pending.id, { status: 'done', text, error: '' });
          this.appendRecognizedText(text);
          track('ocr_success', { chars: text.length });
        }
        next();
      }).catch((err) => {
        if (this._unloaded) {
          next();
          return;
        }
        if (err.code === 'CONFIG') {
          this.setImageItem(pending.id, { status: 'failed', error: err.message || '未配置 OCR Key' });
          this._recognizing = false;
          this.setData({ isRecognizing: false, ocrProgress: '', errorMsg: err.message || '未配置 OCR Key' });
          return;
        }
        if (err.code !== 'ABORTED') {
          this.setImageItem(pending.id, { status: 'failed', error: err.message || '识别失败' });
          track('ocr_fail', { code: err.code || 'UNKNOWN' });
          if (this.data.imageList.some((item) => item.id === pending.id)) {
            wx.showToast({
              title: err.code === 'NO_TEXT' ? '有截图没识别到文字，可点击重试' : '截图识别失败，可点击重试',
              icon: 'none'
            });
          }
        }
        next();
      });
    };

    next();
  },

  setImageItem(id, patch) {
    const imageList = this.data.imageList.map((item) => (
      item.id === id ? Object.assign({}, item, patch) : item
    ));
    this.setData({ imageList });
  },

  appendRecognizedText(text) {
    const next = (text || '').trim();
    if (!next) return;

    const current = this.data.text.trim();
    let merged = current ? `${current}\n${next}` : next;
    if (merged.length > config.limits.maxInputChars) {
      merged = merged.slice(0, config.limits.maxInputChars);
      wx.showToast({ title: '识别内容较长，已截断', icon: 'none' });
    }

    this.setData({
      text: merged,
      charCount: merged.length,
      errorMsg: ''
    });
  },

  retryImage(e) {
    const id = Number(e.currentTarget.dataset.id);
    const item = this.data.imageList.find((image) => image.id === id);
    if (!item || item.status !== 'failed') return;
    this.setImageItem(id, { status: 'pending', error: '' });
    this.recognizePending();
  },

  removeImage(e) {
    const id = Number(e.currentTarget.dataset.id);
    const removed = this.data.imageList.find((image) => image.id === id);
    const imageList = this.data.imageList.filter((image) => image.id !== id);

    let text = this.data.text;
    if (removed && removed.text) {
      const pos = text.indexOf(removed.text);
      if (pos !== -1) {
        text = (text.slice(0, pos) + text.slice(pos + removed.text.length)).trim();
      }
    }

    this.setData({
      imageList,
      text,
      charCount: text.length
    });
  },

  previewImage(e) {
    const id = Number(e.currentTarget.dataset.id);
    const urls = this.data.imageList.map((image) => image.path);
    const current = this.data.imageList.find((image) => image.id === id);
    if (!urls.length) return;
    wx.previewImage({
      urls,
      current: current ? current.path : urls[0]
    });
  },

  /* ---------- 分析 ---------- */

  startAnalysis() {
    if (this.data.isAnalyzing) return;
    if (this.data.isRecognizing) {
      wx.showToast({ title: '截图还在识别中，请稍候', icon: 'none' });
      return;
    }

    const source = this.data.text.trim();
    if (!source) {
      wx.showToast({ title: '先输入或上传聊天内容', icon: 'none' });
      return;
    }

    const masked = maskPII(source);
    const truncated = truncateChat(
      masked.text,
      config.limits.maxInputChars,
      config.limits.headChars,
      config.limits.tailChars
    );

    if (masked.count > 0) {
      wx.showToast({ title: `已自动隐藏 ${masked.count} 处隐私信息`, icon: 'none' });
    }

    track('analyze_start', {
      mode: this.data.mode,
      images: this.data.imageList.length,
      chars: source.length,
      truncated: truncated.truncated
    });

    const token = (this._requestSeq || 0) + 1;
    this._requestSeq = token;

    this.setData({
      isAnalyzing: true,
      errorMsg: '',
      activeStep: 0,
      elapsed: 0,
      loadingHint: '先整理一下聊天记录…',
      piiNote: masked.count > 0 ? `已自动隐藏 ${masked.count} 处隐私信息` : ''
    });
    this.startLoadingTimer();

    analyzeService.analyze({
      text: truncated.text,
      stage: this.data.stage,
      myName: this.data.myName.trim(),
      taName: this.data.taName.trim()
    }).then(({ result, meta }) => {
      if (this._unloaded || token !== this._requestSeq) return;
      this.stopLoadingTimer();

      const saved = storage.saveRecord({
        createdAt: Date.now(),
        score: result.score,
        level: result.level,
        summary: result.summary,
        excerpt: truncated.text.slice(0, 60),
        stage: this.data.stage || '',
        sourceChars: meta.totalChars,
        truncated: meta.truncated,
        result
      });
      sessionContext.set(saved.id, truncated.text);

      track('analyze_success', {
        latency: meta.latency,
        attempts: meta.attempts,
        quotes: result.quality ? result.quality.quotesVerified : 0,
        flagged: result.safety && result.safety.flagged
      });

      this.setData({ isAnalyzing: false });
      wx.navigateTo({ url: `/pages/result/result?id=${saved.id}` });
    }).catch((err) => {
      if (this._unloaded || token !== this._requestSeq) return;
      this.stopLoadingTimer();
      this.setData({ isAnalyzing: false });
      if (err.code === 'ABORTED') return;

      track('analyze_fail', { code: err.code || 'UNKNOWN' });
      this.setData({ errorMsg: this.errorMessage(err) });
    });
  },

  errorMessage(err) {
    const messages = {
      CONFIG: '还没有配置 API Key，请检查 config/secrets.local.js',
      NETWORK: '网络请求失败，请检查网络后重试',
      HTTP: '分析服务暂时不可用，请稍后重试',
      EMPTY: '这次没有生成有效结果，请重试',
      PARSE: '分析结果解析失败，请重试',
      TRUNCATED: '分析结果不完整，请重试',
      OCR_FAIL: '截图识别失败，请换一张截图重试'
    };
    return messages[err.code] || '分析失败，请稍后重试';
  },

  startLoadingTimer() {
    this.stopLoadingTimer();
    this._startedAt = Date.now();

    this._timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this._startedAt) / 1000);
      let hint = '先整理一下聊天记录…';
      if (elapsed >= 25) hint = '还在深度分析，请稍候…';
      else if (elapsed >= 18) hint = '正在把信号翻译成行动建议…';
      else if (elapsed >= 12) hint = '正在对照书中的心动原理…';
      else if (elapsed >= 6) hint = '正在读 TA 的回应方式…';

      this.setData({
        elapsed,
        activeStep: Math.min(3, Math.floor(elapsed / 6)),
        loadingHint: hint
      });
    }, 1000);
  },

  stopLoadingTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  },

  cancelAnalysis() {
    this._requestSeq = (this._requestSeq || 0) + 1;
    analyzeService.abort();
    this.stopLoadingTimer();
    this.setData({ isAnalyzing: false });
    track('analyze_cancel');
    wx.showToast({ title: '已取消分析', icon: 'none' });
  }
});
