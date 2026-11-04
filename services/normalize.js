// 纯函数：把模型返回的 JSON 规范化成页面可以直接渲染的结构。
// 不依赖 wx，可在 Node 中单独测试（见 tests/normalize.test.js）。
const { compact, safeString } = require('../utils/text');
const {
  DIMENSIONS,
  DIMENSION_MAP,
  PRINCIPLE_MAP
} = require('../data/love-framework');

const LEVELS = [
  { min: 0, max: 20, label: '冷静观望', color: '#9AA0A6' },
  { min: 21, max: 40, label: '礼貌距离', color: '#7E8AA2' },
  { min: 41, max: 60, label: '朋友区间', color: '#F0A35E' },
  { min: 61, max: 80, label: '暧昧升温', color: '#FF69B4' },
  { min: 81, max: 100, label: '双向奔赴', color: '#F24B6A' }
];

const REPLIES = [
  { tone: '幽默', fallback: '你这句话，我得回去想三天。' },
  { tone: '真诚', fallback: '收到，我会认真想想你说的。' },
  { tone: '克制', fallback: '嗯，我明白你的意思。' }
];

const DISCLAIMER = '基于这段对话的分析，仅供娱乐参考，不构成心理咨询或命运预测。';

function clampScore(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function levelForScore(score) {
  if (score === null || score === undefined) {
    return { label: '信息不足', color: '#9AA0A6' };
  }
  const level = LEVELS.find((item) => score >= item.min && score <= item.max);
  return level || LEVELS[0];
}

function cleanQuote(value) {
  const text = safeString(value);
  return text
    .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, '')
    .replace(/…+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function verifyQuote(quote, sourceText) {
  const source = compact(sourceText);
  const target = compact(quote);
  return target.length >= 2 && target.length <= 40 && source.indexOf(target) !== -1;
}

function extractJson(content) {
  if (typeof content !== 'string' || !content.trim()) {
    const error = new Error('模型返回为空');
    error.code = 'EMPTY';
    throw error;
  }

  let text = content.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    const error = new Error('模型返回的不是 JSON');
    error.code = 'PARSE';
    throw error;
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    const error = new Error('JSON 解析失败');
    error.code = 'PARSE';
    throw error;
  }
}

function normalizeDimensions(raw, score) {
  const list = Array.isArray(raw) ? raw : [];
  return DIMENSIONS.map((item) => {
    const found = list.find((dimension) => dimension && dimension.key === item.key) || {};
    return {
      key: item.key,
      label: item.label,
      weight: item.weight,
      factor: item.factor,
      score: clampScore(found.score, score),
      reason: safeString(found.reason, '').slice(0, 80)
    };
  });
}

// 总分与五维加权保持一致，避免模型给出的总分和维度互相矛盾。
function compositeScore(dimensions, fallback) {
  if (!Array.isArray(dimensions) || !dimensions.length) return fallback;
  const total = dimensions.reduce((sum, item) => sum + item.score * item.weight, 0);
  return clampScore(Math.round(total / 100), fallback);
}

function normalizeSignals(raw, sourceText, myName) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = {};
  let total = 0;
  let verified = 0;
  const signals = [];
  const selfPattern = new RegExp(`^${escapeRegExp(myName || '我')}\\s*[：:]`);

  list.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    total += 1;
    const type = item.type === 'positive' || item.type === 'risk' ? item.type : 'neutral';
    const factor = DIMENSION_MAP[item.factor] ? item.factor : '';
    const factorLabel = factor ? DIMENSION_MAP[factor].label : '';
    const quote = cleanQuote(item.quote);
    const explain = safeString(item.explain || item.explanation, '');
    if (!quote || !explain) return;
    if (selfPattern.test(quote)) return;
    if (!verifyQuote(quote, sourceText)) return;
    if (seen[quote]) return;

    // "在忙"和"嗯 在忙"属于同一条证据，保留更长的那条。
    const overlapIndex = signals.findIndex((signal) => (
      signal.quote.indexOf(quote) !== -1 || quote.indexOf(signal.quote) !== -1
    ));
    if (overlapIndex !== -1) {
      if (quote.length > signals[overlapIndex].quote.length) {
        signals[overlapIndex] = { type, factor, factorLabel, quote, explain: explain.slice(0, 100) };
        seen[quote] = true;
      }
      return;
    }

    seen[quote] = true;
    verified += 1;
    signals.push({ type, factor, factorLabel, quote, explain: explain.slice(0, 100) });
  });

  return {
    signals: signals.slice(0, 5),
    quality: { quotesTotal: total, quotesVerified: verified }
  };
}

function normalizeNextSteps(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((item) => item && (item.title || item.detail))
    .map((item) => {
      const principle = PRINCIPLE_MAP[item.principle] ? item.principle : '';
      return {
        title: safeString(item.title, '下一步').slice(0, 20),
        detail: safeString(item.detail, '').slice(0, 100),
        principle,
        principleLabel: principle ? PRINCIPLE_MAP[principle].name : ''
      };
    })
    .slice(0, 3);
}

// 模型只选择原理 id，名称、要点由本地知识库补全，避免编造书中原文。
function normalizePrinciples(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = {};
  const principles = [];

  list.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const id = item.id;
    if (!PRINCIPLE_MAP[id] || seen[id]) return;
    const apply = safeString(item.apply, '').slice(0, 80);
    if (!apply) return;
    seen[id] = true;
    principles.push({
      id,
      name: PRINCIPLE_MAP[id].name,
      quote: PRINCIPLE_MAP[id].quote,
      chat: PRINCIPLE_MAP[id].chat,
      tip: PRINCIPLE_MAP[id].tip,
      apply
    });
  });

  return principles.slice(0, 3);
}

function normalizeReplies(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return REPLIES.map((item) => {
    const found = list.find((reply) => reply && reply.tone === item.tone) || {};
    return {
      tone: item.tone,
      text: safeString(found.text, item.fallback).slice(0, 120)
    };
  });
}

function safetyResult(message) {
  const safeMessage = safeString(message, '').slice(0, 200);
  return {
    score: null,
    level: '信息不足',
    confidence: 'low',
    summary: '这段内容可能涉及需要认真对待的情况，我先不给出分数。',
    dimensions: [],
    signals: [],
    nextSteps: [],
    principles: [],
    replies: [],
    safety: {
      flagged: true,
      message: safeMessage || '如果你或身边的人正处于危险或痛苦中，请优先联系信任的人，或拨打心理援助热线 12356（全国统一心理援助热线）。'
    },
    disclaimer: DISCLAIMER,
    quality: { quotesTotal: 0, quotesVerified: 0 }
  };
}

function normalizeResult(raw, sourceText, options) {
  if (!raw || typeof raw !== 'object') {
    const error = new Error('分析结果格式不正确');
    error.code = 'PARSE';
    throw error;
  }

  const safety = raw.safety && typeof raw.safety === 'object' ? raw.safety : {};
  if (safety.flagged) {
    return safetyResult(safety.message);
  }

  const opts = options || {};
  const rawScore = clampScore(raw.score, 50);
  const dimensions = normalizeDimensions(raw.dimensions, rawScore);
  const score = compositeScore(dimensions, rawScore);
  const level = levelForScore(score);
  const signalResult = normalizeSignals(raw.signals, sourceText, opts.myName);
  let confidence = ['high', 'medium', 'low'].indexOf(raw.confidence) !== -1 ? raw.confidence : 'medium';
  if (signalResult.quality.quotesTotal > 0 && signalResult.quality.quotesVerified === 0) {
    confidence = 'low';
  }

  return {
    score,
    level: level.label,
    levelColor: level.color,
    confidence,
    summary: safeString(raw.summary, '这段对话里还有一些值得留意的信号。').slice(0, 80),
    dimensions,
    signals: signalResult.signals,
    nextSteps: normalizeNextSteps(raw.nextSteps),
    principles: normalizePrinciples(raw.principles),
    replies: normalizeReplies(raw.replies),
    safety: {
      flagged: false,
      message: ''
    },
    disclaimer: safeString(raw.disclaimer, DISCLAIMER).slice(0, 120),
    quality: signalResult.quality
  };
}

module.exports = {
  LEVELS,
  DIMENSIONS,
  DISCLAIMER,
  clampScore,
  compositeScore,
  levelForScore,
  verifyQuote,
  extractJson,
  normalizeResult,
  safetyResult
};
