/**
 * 主菜单界面：全屏标题 + 开始游戏。
 * 新手引导关闭时直接进正式游戏；打开后第一次开始会先进入试玩关。
 */
const MenuScene = {
  el: document.getElementById("menuscene"),

  enter() {
    this.bind();
  },

  leave() {
    this.el.hidden = true;
  },

  bind() {
    document.getElementById("menu-start").onclick = () => {
      if (TutorialGuide.shouldStart({})) {
        App.show("game", { trial: true });
      } else {
        App.show("game", { fresh: true, skipTrial: true });
      }
    };
  }
};

App.register("menu", MenuScene);
