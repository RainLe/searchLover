// 提交前本地脱敏：手机号、身份证、银行卡、邮箱。
// 注意：这是尽力而为的正则，不替代正式的隐私合规方案。

const RULES = [
  {
    type: '身份证',
    mask: '[身份证]',
    pattern: /(^|[^0-9])(\d{17}[\dXx])(?![0-9Xx])/g
  },
  {
    type: '银行卡',
    mask: '[银行卡]',
    pattern: /(^|[^0-9])(\d{16,19})(?![0-9])/g
  },
  {
    type: '手机号',
    mask: '[手机号]',
    pattern: /(^|[^0-9])(1[3-9]\d{9})(?![0-9])/g
  },
  {
    type: '邮箱',
    mask: '[邮箱]',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
  }
];

const SENSITIVE_WORDS = [
  '自杀', '自残', '自伤', '割腕', '想死', '不想活', '轻生', '跳楼',
  '活着没意思', '结束生命', '家暴', '强奸', '性侵', '未成年', '猥亵'
];

function maskPII(text) {
  let output = text || '';
  let count = 0;
  const types = [];

  RULES.forEach((rule) => {
    output = output.replace(rule.pattern, (match, prefix) => {
      count += 1;
      if (types.indexOf(rule.type) === -1) types.push(rule.type);
      return `${prefix}${rule.mask}`;
    });
  });

  return { text: output, count, types };
}

function detectSensitive(text) {
  const source = text || '';
  const matched = SENSITIVE_WORDS.filter((word) => source.indexOf(word) !== -1);
  return { flagged: matched.length > 0, words: matched };
}

module.exports = {
  maskPII,
  detectSensitive
};
