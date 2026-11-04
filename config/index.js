// 全局常量。密钥单独放在 secrets.local.js（已在 .gitignore 中）。
const secrets = require('./secrets.local');

const STAGES = [
  { value: 'just-met', label: '刚认识' },
  { value: 'flirting', label: '暧昧中' },
  { value: 'dating', label: '恋爱中' },
  { value: 'cooling', label: '关系降温' }
];

module.exports = {
  api: {
    deepseekBase: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-chat',
    requestTimeout: 120000
  },
  ocr: {
    url: 'https://api.ocr.space/parse/image',
    language: 'chs',
    maxImages: 9,
    compressQuality: 80,
    // 同一张截图识别过就直接复用缓存结果，无需再次请求 OCR。
    cache: {
      limit: 50,
      ttlDays: 7
    }
  },
  limits: {
    maxInputChars: 6000,
    headChars: 2500,
    tailChars: 3500,
    historyLimit: 20,
    maxSignals: 5,
    maxFollowUpTurns: 6,
    maxFollowUpChars: 800
  },
  stages: STAGES,
  secrets
};
