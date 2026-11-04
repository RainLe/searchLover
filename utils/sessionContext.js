// 只在本次小程序运行期间保存脱敏后的聊天上下文，供"继续追问"使用。
// 不写入本地存储，退出后自动丢失；最多保留 20 条，与本地记录上限一致。
const MAX_ENTRIES = 20;
let cache = {};
let order = [];

function set(id, text) {
  if (!id) return;
  if (!Object.prototype.hasOwnProperty.call(cache, id)) order.push(id);
  cache[id] = text || '';
  while (order.length > MAX_ENTRIES) {
    const oldest = order.shift();
    delete cache[oldest];
  }
}

function get(id) {
  return cache[id] || '';
}

function remove(id) {
  delete cache[id];
  order = order.filter((item) => item !== id);
}

function clear() {
  cache = {};
  order = [];
}

module.exports = { set, get, remove, clear };
