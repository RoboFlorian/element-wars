/**
 * 主菜单界面：全屏标题 + 开始游戏。
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
    document.getElementById("menu-start").onclick = () =>
      App.show("game", { fresh: true, tutorial: TutorialGuide.shouldStart({}) });
  }
};

App.register("menu", MenuScene);
