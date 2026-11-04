// 纯 Node 测试：node tests/normalize.test.js
const assert = require('assert');
const {
  clampScore,
  compositeScore,
  levelForScore,
  verifyQuote,
  extractJson,
  normalizeResult,
  safetyResult
} = require('../services/normalize');

const source = '她：你今天怎么这么晚还没睡\n我：刚忙完\n她：别老熬夜，明天还会问你。';

assert.strictEqual(clampScore(120, 50), 100);
assert.strictEqual(clampScore(-3, 50), 0);
assert.strictEqual(clampScore('abc', 50), 50);
assert.strictEqual(clampScore(null, 50), 50);
assert.strictEqual(clampScore('', 50), 50);
assert.strictEqual(levelForScore(72).label, '暧昧升温');
assert.strictEqual(levelForScore(null).label, '信息不足');

assert.strictEqual(verifyQuote('别老熬夜', source), true);
assert.strictEqual(verifyQuote('她一定喜欢你', source), false);

assert.deepStrictEqual(extractJson('```json\n{"score": 70}\n```'), { score: 70 });
assert.deepStrictEqual(extractJson('前面废话 {"score": 70} 后面废话'), { score: 70 });

assert.strictEqual(compositeScore([
  { score: 80, weight: 20 },
  { score: 66, weight: 20 },
  { score: 60, weight: 15 },
  { score: 74, weight: 20 },
  { score: 70, weight: 25 }
], 50), 71);

const result = normalizeResult({
  score: 72,
  confidence: 'high',
  summary: '她有明显好感，但节奏偏慢。',
  dimensions: [
    { key: 'attraction', score: 80, reason: '主动关心作息' },
    { key: 'similarity', score: 66, reason: '会接住你的话题' },
    { key: 'complement', score: 60, reason: '还没有明显的互补信号' },
    { key: 'esteem', score: 74, reason: '记住你的习惯' },
    { key: 'momentum', score: 70, reason: '愿意继续聊' }
  ],
  signals: [
    {
      type: 'positive',
      factor: 'esteem',
      quote: '别老熬夜，明天还会问你。',
      explain: '关心并记住你的作息'
    },
    { type: 'risk', factor: 'momentum', quote: '这句是编的', explain: '不存在于原文' }
  ],
  nextSteps: [{ title: '放慢节奏', detail: '今晚不追问', principle: 'equity' }],
  principles: [
    { id: 'esteem', apply: '她记住了你的作息，这是自尊滋养的信号。' },
    { id: 'not-exist', apply: '不存在的原理应该被丢弃' },
    { id: 'equity', apply: '接下来保持互惠，不要单方面加码。' }
  ],
  replies: [{ tone: '幽默', text: '那我争取早点睡。' }]
}, source);

assert.strictEqual(result.score, 71);
assert.strictEqual(result.level, '暧昧升温');
assert.strictEqual(result.dimensions.length, 5);
assert.strictEqual(result.dimensions[0].key, 'attraction');
assert.strictEqual(result.dimensions[0].label, '初见吸引');
assert.strictEqual(result.signals.length, 1);
assert.strictEqual(result.signals[0].factorLabel, '自尊滋养');
assert.strictEqual(result.quality.quotesTotal, 2);
assert.strictEqual(result.quality.quotesVerified, 1);
assert.strictEqual(result.nextSteps[0].principleLabel, '等价原则');
assert.strictEqual(result.principles.length, 2);
assert.strictEqual(result.principles[0].name, '自尊按摩');
assert.strictEqual(result.principles[1].name, '等价原则');
assert.strictEqual(result.replies.length, 3);
assert.strictEqual(result.replies[0].text, '那我争取早点睡。');
assert.ok(result.replies[1].text);
assert.strictEqual(result.confidence, 'high');

const fabricated = normalizeResult({
  score: 70,
  confidence: 'high',
  signals: [{ type: 'positive', quote: '这句不存在', explain: '编造的' }]
}, source);
assert.strictEqual(fabricated.signals.length, 0);
assert.strictEqual(fabricated.confidence, 'low');
assert.strictEqual(fabricated.dimensions.length, 5);

const selfQuote = normalizeResult({
  score: 70,
  signals: [{ type: 'positive', quote: '我：刚忙完', explain: '引用了用户自己的话' }]
}, source, { myName: '我' });
assert.strictEqual(selfQuote.signals.length, 0);

const deduped = normalizeResult({
  score: 70,
  signals: [
    { type: 'risk', factor: 'momentum', quote: '在忙', explain: '短句' },
    { type: 'risk', factor: 'momentum', quote: '嗯 在忙', explain: '更完整' }
  ]
}, 'TA：嗯 在忙');
assert.strictEqual(deduped.signals.length, 1);
assert.strictEqual(deduped.signals[0].quote, '嗯 在忙');
assert.strictEqual(deduped.signals[0].factorLabel, '投入推进');

const flagged = safetyResult('请联系可信任的人。');
assert.strictEqual(flagged.score, null);
assert.strictEqual(flagged.safety.flagged, true);
assert.strictEqual(flagged.dimensions.length, 0);
assert.strictEqual(flagged.principles.length, 0);

console.log('normalize tests passed');
