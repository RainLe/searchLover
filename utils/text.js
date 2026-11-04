// 文本处理工具（纯函数，方便在 Node 中单独验证）

/**
 * 超长聊天记录只保留首尾，避免 token 失控。
 * 返回结构便于页面提示用户。
 */
function truncateChat(text, max, head, tail) {
  const source = text || '';
  if (source.length <= max) {
    return { text: source, truncated: false, total: source.length };
  }
  const headText = source.slice(0, head);
  const tailText = source.slice(-tail);
  return {
    text: `${headText}\n……（中间省略 ${source.length - head - tail} 字）……\n${tailText}`,
    truncated: true,
    total: source.length
  };
}

/** 去掉空白，用于校验模型引用是否真的来自原文 */
function compact(text) {
  return (text || '').replace(/\s+/g, '');
}

function safeString(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback || '';
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatShortDate(timestamp) {
  const date = new Date(timestamp);
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

module.exports = {
  truncateChat,
  compact,
  safeString,
  formatDate,
  formatShortDate
};
