/**
 * 祝福三选一：击败怪物后的奖励界面（半透明遮罩叠在游戏上）。
 * 展示名称、内容；整卡底色表示稀有度（不展示说明 note）。
 */
const BlessingScene = {
  el: document.getElementById("blessingscene"),

  enter(data) {
    this.category = (data && data.category) || "all";
    this.fromDefeat = Boolean(data && data.fromDefeat);
    this.returnTo = (data && data.returnTo) || {
      scene: "game",
      payload: this.fromDefeat ? {} : { resume: true }
    };
    const eyebrow = document.getElementById("blessing-eyebrow");
    const title = document.getElementById("blessing-title");
    const tagline = document.getElementById("blessing-tagline");
    if (eyebrow) eyebrow.textContent = this.fromDefeat ? "击败奖励" : "祝福";
    if (title) title.textContent = "选一个祝福";
    if (tagline) tagline.textContent = "三选一，效果马上生效";
    const game = typeof GameScene !== "undefined" ? GameScene : null;
    const cards = Blessings.pickThree(game, this.category);
    this.render(cards);
  },

  leave() {
    this.el.hidden = true;
  },

  render(cards) {
    const row = document.getElementById("blessing-cards");
    row.innerHTML = "";
    if (!cards.length) {
      row.innerHTML = `<p class="blessing-text">暂无可选祝福</p>`;
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "btn btn-primary";
      skip.textContent = "继续";
      skip.onclick = () => this.finish(null);
      row.appendChild(skip);
      return;
    }
    cards.forEach((card) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "blessing-card";
      btn.dataset.rarity = card.rarity;
      btn.innerHTML = `<h3 class="blessing-text">${card.name}</h3><p class="blessing-text">${card.desc}</p>`;
      btn.onclick = () => this.choose(card);
      row.appendChild(btn);
    });
  },

  choose(card) {
    this.finish(card);
  },

  finish(card) {
    const ret = this.returnTo || { scene: "game", payload: {} };
    const payload = Object.assign({}, ret.payload || {}, {
      afterBlessing: true,
      fromDefeat: this.fromDefeat,
      blessingId: card ? card.id : null
    });
    App.show(ret.scene || "game", payload);
  }
};

App.register("blessing", BlessingScene);
