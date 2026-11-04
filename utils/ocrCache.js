// 截图识别结果缓存：同一张图片重复上传时直接复用，避免重复调用 OCR。
// 只缓存识别后的文字，不保存图片本身。
const config = require('../config/index');

const KEY = 'ocr_cache_v1';
const LIMIT = (config.ocr.cache && config.ocr.cache.limit) || 50;
const TTL = ((config.ocr.cache && config.ocr.cache.ttlDays) || 7) * 24 * 60 * 60 * 1000;

function isFresh(entry) {
  return !!entry
    && typeof entry.key === 'string'
    && typeof entry.text === 'string'
    && !!entry.text
    && typeof entry.at === 'number'
    && Date.now() - entry.at < TTL;
}

function readAll() {
  try {
    const list = wx.getStorageSync(KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function persist(list) {
  try {
    wx.setStorageSync(KEY, list.slice(-LIMIT));
  } catch (e) {
    // 存储空间不足时静默失败，不阻塞识别主流程
  }
}

function get(key) {
  if (!key) return '';
  const list = readAll();
  const entry = list.find((item) => item && item.key === key && isFresh(item));

  if (!entry) {
    // 顺手清掉过期项，避免缓存无限膨胀。
    const fresh = list.filter(isFresh);
    if (fresh.length !== list.length) persist(fresh);
    return '';
  }

  // 命中后刷新时间并移到末尾，按最近使用淘汰。
  persist(list.filter((item) => item !== entry).concat([{
    key,
    text: entry.text,
    at: Date.now()
  }]));
  return entry.text;
}

function set(key, text) {
  const value = (text || '').trim();
  if (!key || !value) return;
  const list = readAll().filter((item) => isFresh(item) && item.key !== key);
  list.push({ key, text: value, at: Date.now() });
  persist(list);
}

function clear() {
  try {
    wx.removeStorageSync(KEY);
  } catch (e) {
    // ignore
  }
}

module.exports = {
  get,
  set,
  clear
};
