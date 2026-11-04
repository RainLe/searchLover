// 本地分析记录。只保存在用户自己的设备上，不存截图、不存完整聊天原文。
const config = require('../config/index');

const KEY = 'heart_records_v2';
// 旧版本记录不再兼容，直接丢弃，不做迁移。
const LEGACY_KEYS = ['heart_records_v1'];

try {
  LEGACY_KEYS.forEach((key) => wx.removeStorageSync(key));
} catch (e) {
  // ignore
}

function getRecords() {
  try {
    const records = wx.getStorageSync(KEY);
    return Array.isArray(records) ? records : [];
  } catch (e) {
    return [];
  }
}

function persist(records) {
  try {
    wx.setStorageSync(KEY, records.slice(0, config.limits.historyLimit));
  } catch (e) {
    // 存储空间不足时静默失败，不阻塞主流程
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveRecord(record) {
  const records = getRecords();
  const next = Object.assign({}, record, {
    id: record.id || makeId(),
    createdAt: record.createdAt || Date.now()
  });
  records.unshift(next);
  persist(records);
  return next;
}

function getRecord(id) {
  return getRecords().find((record) => record.id === id) || null;
}

function updateRecord(id, patch) {
  const records = getRecords().map((record) => (
    record.id === id ? Object.assign({}, record, patch) : record
  ));
  persist(records);
  return getRecord(id);
}

function removeRecord(id) {
  persist(getRecords().filter((record) => record.id !== id));
}

function clearRecords() {
  try {
    wx.removeStorageSync(KEY);
  } catch (e) {
    // ignore
  }
}

function getLatest() {
  const records = getRecords();
  return records.length ? records[0] : null;
}

module.exports = {
  getRecords,
  saveRecord,
  getRecord,
  updateRecord,
  removeRecord,
  clearRecords,
  getLatest
};
