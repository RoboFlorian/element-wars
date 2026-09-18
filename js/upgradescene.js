/**
 * 选牌界面：打倒怪物后出现，三张卡里选一张，效果马上生效。
 */
const UpgradeScene = {
  el: document.getElementById("upgradescene"),

  POOL: [
    {
      id: "heal",
      name: "回春",
      icon: "♥",
      desc: "立刻恢复 30 点体力。",
      apply(game) {
        game.playerHp = Math.min(game.playerMax, game.playerHp + 30);
      }
    },
    {
      id: "maxhp",
      name: "厚皮",
      icon: "＋",
      desc: "体力上限 +20，并恢复 20。",
      apply(game) {
        game.playerMax += 20;
        game.playerHp = Math.min(game.playerMax, game.playerHp + 20);
      }
    },
    {
      id: "guard",
      name: "坚韧",
      icon: "◆",
      desc: "以后每次挨打少受 2 点伤害。",
      apply(game) {
        game.buffs.incomingReduce += 2;
      }
    },
    {
      id: "slow",
      name: "缓兵",
      icon: "⏱",
      desc: "怪物出手前，你可多操作 2 次。",
      apply(game) {
        game.buffs.extraActions += 2;
      }
    },
    {
      id: "sharp",
      name: "锋刃",
      icon: "✦",
      desc: "打出的方块伤害 +4。",
      apply(game) {
        game.buffs.damageFlat += 4;
      }
    },
    {
      id: "vamp",
      name: "汲取",
      icon: "✧",
      desc: "打怪时按伤害回复 20% 体力。",
      apply(game) {
        game.buffs.lifesteal += 0.2;
      }
    },
    {
      id: "gift",
      name: "补给",
      icon: "8",
      desc: "棋盘空位出现一个 8。",
      apply(game) {
        game.addTile(8);
      }
    }
  ],

  enter() {
    this.render(this.pickThree());
  },

  leave() {
    this.el.hidden = true;
  },

  pickThree() {
    const pool = this.POOL.slice();
    const picked = [];
    while (picked.length < 3 && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
  },

  render(cards) {
    const row = document.getElementById("upgrade-cards");
    row.innerHTML = "";
    cards.forEach((card) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "upgrade-card";
      btn.innerHTML = `<span class="card-icon">${card.icon}</span><h3>${card.name}</h3><p>${card.desc}</p>`;
      btn.onclick = () => this.choose(card);
      row.appendChild(btn);
    });
  },

  choose(card) {
    App.show("game", { afterUpgrade: true, upgradeId: card.id });
  }
};

App.register("upgrade", UpgradeScene);
