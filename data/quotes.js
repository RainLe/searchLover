// 首页随机展示的恋爱金句，均摘自《稳稳俘获意中人：如何让你爱的人爱上你》。
const SOURCE = '《稳稳俘获意中人：如何让你爱的人爱上你》';

const QUOTES = [
  { text: '爱情的种子常常是在两人初见的几分钟之内萌发的。', source: SOURCE },
  { text: '在男女互动的最初几分钟，双方都会做出数十种无意识的动作，透露出自己的内心。', source: SOURCE },
  { text: '一旦你们将目光投在彼此身上，你的意中人立刻就会在不知不觉中读懂你的身体语言。', source: SOURCE },
  { text: '相似性让我们感到自在，因为这给我们一种肯定，让我们相信自己之前的人生做了正确的选择。', source: SOURCE },
  { text: '我们喜欢寻找那些兴趣相似的同类，那样我们就可以一起分享并共度快乐时光。', source: SOURCE },
  { text: '相似性确实是让亲密关系正常起飞的一个良好发射台。', source: SOURCE },
  { text: '我们寻找的伴侣和我们既有相似性、也有互补性。', source: SOURCE },
  { text: '在轰轰烈烈的爱情中，最令人心动的核心内容就是人的自我价值感。', source: SOURCE },
  { text: '每个人都需要安全感，希望得到别人的认可。', source: SOURCE },
  { text: '在这个残忍的世界上，我们总是希望从爱情中找到庇护。', source: SOURCE },
  { text: '恋人身上最性感的器官，是他（或她）的大脑。', source: SOURCE },
  { text: '时机，在恋爱中是非常重要的一个因素——如果不是最重要的因素的话。', source: SOURCE },
  { text: '一位意中人必须是一个做好准备去爱的人。', source: SOURCE },
  { text: '陷入爱情的诱因其实深深地埋在我们的心里。', source: SOURCE },
  { text: '这种迷狂确实可以持续一段时间，虽然不长，但足以让成熟的爱情生根发芽。', source: SOURCE }
];

// 随机取一句；传入当前句子可以避免连续两次显示同一句。
function pickRandom(current) {
  if (QUOTES.length === 0) return null;
  if (QUOTES.length === 1) return QUOTES[0];

  const currentText = current && current.text;
  let next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  while (next.text === currentText) {
    next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }
  return next;
}

module.exports = {
  QUOTES,
  pickRandom
};
