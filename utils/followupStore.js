// 追问消息只保存在本次运行的内存里：返回结果页再进入仍能看到，退出小程序即清空。
// 与 sessionContext 一样不落盘，避免把追问内容写进本地存储。
const MAX_ENTRIES = 20;
let cache = {};
let order = [];

function get(id) {
  return cache[id] ? cache[id].slice() : [];
}

function set(id, messages) {
  if (!id) return;
  if (!Object.prototype.hasOwnProperty.call(cache, id)) order.push(id);
  cache[id] = (messages || []).slice();
  while (order.length > MAX_ENTRIES) {
    delete cache[order.shift()];
  }
}

function remove(id) {
  delete cache[id];
  order = order.filter((item) => item !== id);
}

function clear() {
  cache = {};
  order = [];
}

module.exports = { get, set, remove, clear };
