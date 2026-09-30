/**
 * 结算界面：生命没了之后出现，告诉你这局到了第几波。
 */
const ResultScene = {
  el: document.getElementById("resultscene"),

  enter(data) {
    const wave = data.wave || 1;
    const isRecord = Boolean(data.isRecord);
    document.getElementById("result-eyebrow").textContent = isRecord ? "新纪录" : "本局结束";
    document.getElementById("result-title").textContent = isRecord ? "冲得更远了！" : "你倒下了";
    document.getElementById("result-desc").textContent = isRecord
      ? "这是目前到达的最高波次。还能再往前冲。"
      : "生命耗尽，怪物把你打停了。方块合得越高级，拖去攻击越痛；拖到血条上的护盾要选怪物克制不了的元素。";
    document.getElementById("result-tile").textContent = `第 ${wave} 波`;
    document.getElementById("result-time").textContent = App.formatTime(data.surviveSec || 0);
    document.getElementById("result-best").textContent = String(data.best || App.best);
    document.getElementById("result-wave").textContent = String(wave);
    document.getElementById("result-score").textContent = data.score || 0;

    const primary = document.getElementById("result-primary");
    const secondary = document.getElementById("result-secondary");
    primary.textContent = "再来一局";
    secondary.textContent = "返回菜单";
    primary.onclick = () => App.show("game", { fresh: true });
    secondary.onclick = () => App.show("menu");
  },

  leave() {
    this.el.hidden = true;
  }
};

App.register("result", ResultScene);

window.Pink2048 = { App, MenuScene, GameScene, ResultScene, BlessingScene, Blessings, GameEngine, Elements, Stats, TutorialGuide };
