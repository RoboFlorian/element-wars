/**
 * 新手引导：全屏半透明黑遮罩，只留出当前要操作的地方。
 * 玩家按提示做对一步，就进入下一步；做完后恢复正常游戏。
 */
const TutorialGuide = {
  active: false,
  played: false,
  stepIndex: 0,
  targetEl: null,
  pad: 8,

  STEPS: [
    {
      id: "move",
      text: "先滑动一次：用方向键、WASD，或在棋盘上滑。四个角是锁住的，其余格子都能用。",
      focus: "board",
      wait: "move",
      tipPos: "top"
    },
    {
      id: "dirs",
      text: "看棋盘四边颜色——上绿=风，下黄=土，左蓝=水，右红=火。成功往哪边滑，原来的数字块就变成那种颜色；新冒出来的白块还没有属性。",
      focus: "board",
      wait: "next",
      tipPos: "top"
    },
    {
      id: "monster",
      text: "看这里：这行就是怪物的属性（水/火/土/风）。用克制它的元素打出去，伤害是 2 倍；被它克制则只有半倍。",
      focus: "monster-element",
      wait: "next",
      tipPos: "bottom"
    },
    {
      id: "advantage",
      text: "格子左上角：▲ 表示克制，▼ 表示被克制；白色块没有属性，也没有箭头。想染色，就再往对应颜色的边成功滑一次（滑不动不算）。",
      focus: "board",
      wait: "next",
      tipPos: "top"
    },
    {
      id: "actions",
      text: "这里是怪物出手倒计时：你每成功移动或打出一次，次数就减 1；减到 0 它会反击。",
      focus: "attack",
      wait: "next",
      tipPos: "bottom"
    },
    {
      id: "select",
      text: "点一下某个数字块，选中它（会出现加粗描边）。合成只把数字变大，属性跟滑动方向走。",
      focus: "tile",
      wait: "select",
      tipPos: "top"
    },
    {
      id: "launch",
      text: "再点同一块，把它丢出去打怪。伤害看数字和当前颜色（属性）。这是练习：怪物不掉血，结束后会重开第一关。",
      focus: "tile",
      wait: "launch",
      tipPos: "top"
    },
    {
      id: "done",
      text: "引导结束。记住：先看怪物属性，再决定往哪滑（换颜色），然后合成或打出。点下面开始正式游戏。",
      focus: "board",
      wait: "next",
      tipPos: "top"
    }
  ],

  isActive() {
    return this.active;
  },

  /** 引导中先不让怪物按次数反击，避免打断学习 */
  blocksCombat() {
    return this.active;
  },

  shouldStart(data) {
    if (data && data.forceTutorial) return true;
    if (data && data.skipTutorial) return false;
    return !this.played;
  },

  start() {
    if (this.active) return;
    this.played = true;
    this.cacheDom();
    this.active = true;
    this.stepIndex = 0;
    this.overlay.hidden = false;
    document.body.classList.add("is-tutorial");
    this.bind();
    this.showStep();
  },

  end() {
    this.dismiss(true);
  },

  dismiss(markComplete) {
    const shouldReset = markComplete && this.active;
    this.active = false;
    this.targetEl = null;
    if (this.overlay) this.overlay.hidden = true;
    document.body.classList.remove("is-tutorial");
    this.unbind();
    // 练习不计入正式对局：结束或跳过后，第一关重新开
    if (shouldReset && typeof GameScene !== "undefined" && GameScene.newGame) {
      GameScene.newGame();
    }
  },

  cacheDom() {
    this.overlay = document.getElementById("tutorial-overlay");
    this.shadeTop = document.getElementById("tutorial-shade-top");
    this.shadeLeft = document.getElementById("tutorial-shade-left");
    this.shadeRight = document.getElementById("tutorial-shade-right");
    this.shadeBottom = document.getElementById("tutorial-shade-bottom");
    this.frame = document.getElementById("tutorial-frame");
    this.tip = document.getElementById("tutorial-tip");
    this.stepEl = document.getElementById("tutorial-step");
    this.textEl = document.getElementById("tutorial-text");
    this.nextBtn = document.getElementById("tutorial-next");
    this.skipBtn = document.getElementById("tutorial-skip");
  },

  bind() {
    this.onNext = () => this.advance();
    this.onSkip = () => this.end();
    this.onResize = () => this.refreshFocus();
    this.nextBtn.onclick = this.onNext;
    this.skipBtn.onclick = this.onSkip;
    window.addEventListener("resize", this.onResize);
  },

  unbind() {
    if (this.nextBtn) this.nextBtn.onclick = null;
    if (this.skipBtn) this.skipBtn.onclick = null;
    window.removeEventListener("resize", this.onResize);
  },

  current() {
    return this.STEPS[this.stepIndex];
  },

  showStep() {
    const step = this.current();
    if (!step) {
      this.end();
      return;
    }
    this.stepEl.textContent = `${this.stepIndex + 1} / ${this.STEPS.length}`;
    this.textEl.textContent = step.text;
    this.nextBtn.hidden = step.wait !== "next";
    this.nextBtn.textContent = step.id === "done" ? "开始正式游戏" : "下一步";
    this.tip.classList.toggle("is-top", step.tipPos === "top");
    this.refreshFocus();
  },

  resolveFocusEl(step) {
    if (step.focus === "board") return document.getElementById("game-board");
    if (step.focus === "monster") return document.getElementById("monster");
    if (step.focus === "monster-element") return document.getElementById("monster-element");
    if (step.focus === "attack") return document.getElementById("monster-attack-line");
    if (step.focus === "tile") {
      const selected = GameScene.selected && GameScene.selected.el;
      if (selected) return selected;
      return document.querySelector("#game-tiles .tile");
    }
    return document.getElementById("game-board");
  },

  refreshFocus() {
    if (!this.active) return;
    const step = this.current();
    if (!step) return;
    const el = this.resolveFocusEl(step);
    this.targetEl = el;
    if (!el) {
      this.setHole(16, 16, window.innerWidth - 32, 180, "16px");
      return;
    }
    const rect = el.getBoundingClientRect();
    const radius = getComputedStyle(el).borderRadius || "16px";
    // 属性这一行比较扁，多留一点边，方便看清
    const pad = step.focus === "monster-element" ? 14 : this.pad;
    this.setHole(rect.left, rect.top, rect.width, rect.height, radius, pad);
  },

  setHole(x, y, w, h, radius = "16px", pad = this.pad) {
    const left = Math.max(0, x - pad);
    const top = Math.max(0, y - pad);
    const width = Math.min(window.innerWidth - left, w + pad * 2);
    const height = Math.min(window.innerHeight - top, h + pad * 2);
    const right = left + width;
    const bottom = top + height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    this.shadeTop.style.cssText = `left:0;top:0;width:${vw}px;height:${top}px;`;
    this.shadeLeft.style.cssText = `left:0;top:${top}px;width:${left}px;height:${height}px;`;
    this.shadeRight.style.cssText = `left:${right}px;top:${top}px;width:${Math.max(0, vw - right)}px;height:${height}px;`;
    this.shadeBottom.style.cssText = `left:0;top:${bottom}px;width:${vw}px;height:${Math.max(0, vh - bottom)}px;`;
    this.frame.style.cssText =
      `left:${left}px;top:${top}px;width:${width}px;height:${height}px;border-radius:${radius};`;
  },

  notify(eventName) {
    if (!this.active) return;
    const step = this.current();
    if (!step || step.wait !== eventName) return;
    this.advance();
  },

  advance() {
    this.stepIndex += 1;
    if (this.stepIndex >= this.STEPS.length) {
      this.end();
      return;
    }
    this.showStep();
  }
};

window.TutorialGuide = TutorialGuide;
