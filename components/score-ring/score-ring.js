Component({
  properties: {
    score: { type: Number, value: 0 },
    size: { type: Number, value: 220 },
    level: { type: String, value: '' },
    color: { type: String, value: '#FF69B4' }
  },

  data: {
    displayScore: 0
  },

  observers: {
    'score, color': function (score, color) {
      this.draw(score, color);
    }
  },

  lifetimes: {
    attached() {
      this._ready = false;
      this._timer = null;
    },
    ready() {
      this.initCanvas();
    },
    detached() {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
    }
  },

  methods: {
    initCanvas() {
      this.createSelectorQuery()
        .select('#ring')
        .fields({ node: true, size: true })
        .exec((res) => {
          const item = res && res[0];
          if (!item || !item.node || !item.width) {
            this.setData({ displayScore: Math.round(Number(this.properties.score) || 0) });
            return;
          }

          const canvas = item.node;
          const dpr = wx.getSystemInfoSync().pixelRatio || 1;
          canvas.width = item.width * dpr;
          canvas.height = item.height * dpr;

          const ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);

          this._canvas = canvas;
          this._ctx = ctx;
          this._size = item.width;
          this._ready = true;
          this.draw(this.properties.score, this.properties.color);
        });
    },

    draw(score, color) {
      const target = Math.max(0, Math.min(100, Number(score) || 0));

      // 画布还没准备好时先不写 displayScore，等 ready 后从 0 做数字动画。
      if (!this._ready) return;

      if (this._timer) clearInterval(this._timer);

      const startedAt = Date.now();
      const startValue = Number(this.data.displayScore) || 0;
      const duration = 600;

      const tick = () => {
        const ratio = Math.min(1, (Date.now() - startedAt) / duration);
        const eased = 1 - Math.pow(1 - ratio, 3);
        const value = startValue + (target - startValue) * eased;
        this.paint(value, color);
        this.setData({ displayScore: Math.round(value) });
        if (ratio >= 1) {
          clearInterval(this._timer);
          this._timer = null;
        }
      };

      tick();
      this._timer = setInterval(tick, 33);
    },

    paint(value, color) {
      const ctx = this._ctx;
      const size = this._size;
      if (!ctx || !size) return;

      const center = size / 2;
      const radius = center - 10;
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * (value / 100);

      ctx.clearRect(0, 0, size, size);
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';

      ctx.strokeStyle = 'rgba(255, 105, 180, 0.12)';
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (value <= 0) return;

      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, '#FFB6C1');
      gradient.addColorStop(1, color || '#FF69B4');
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.arc(center, center, radius, start, end);
      ctx.stroke();
    }
  }
});
