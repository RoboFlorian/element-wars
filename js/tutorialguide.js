/**
 * 试玩关卡：第一次开始游戏时进入的独立练习关。
 * 带分步指引；打完或跳过后记入本地，之后不会再进。
 * 试玩不计入正式波次与纪录。
 */
const TutorialGuide = {
  /** 总开关：false 时不进试玩、不显示任何引导（代码保留，方便以后打开） */
  ENABLED: false,
  KEY: "elementwar-trial-done",
  active: false,
  stepIndex: 0,
  targetEl: null,
  pad: 8,

  STEPS: [
    {
      id: "move",
      text: "【试玩关】先滑动一次。数字相同的方块撞在一起会合成更大的数字。",
      focus: "board",
      wait: "move",
      tipPos: "top"
    },
    {
      id: "dirs",
      text: "每次结算伤害都带一种元素：每 4 次攻击里，水、火、土、风各出现一次，顺序随机。",
      focus: "board",
      wait: "next",
      tipPos: "top"
    },
    {
      id: "monster",
      text: "看这里：这个圆标就是怪物的属性（水/火/土/风）。每隔几个回合，场上所有方块的数字会加起来打它一次；这次攻击的元素克制它，伤害 2 倍，被它克制则只有半倍。",
      focus: "monster-element",
      wait: "next",
      tipPos: "bottom"
    },
    {
      id: "advantage",
      text: "方块的颜色就是下一次攻击的元素；左上角 ▲ 表示克制怪物，▼ 表示被克制。",
      focus: "board",
      wait: "next",
      tipPos: "top"
    },
    {
      id: "actions",
      text: "这里是怪物出手倒计时：你每完成一次滑动或消除（一个回合），次数就减 1；减到 0 它会反击。试玩里怪物先不会真的打你。",
      focus: "attack",
      wait: "next",
      tipPos: "bottom"
    },
    {
      id: "select",
      text: "点一下某个数字块，选中它（会出现加粗描边）。",
      focus: "tile",
      wait: "select",
      tipPos: "top"
    },
    {
      id: "eliminate",
      text: "再点同一块，把它消除，腾出格子。消除也算一个回合。试玩里怪物不掉血，分数也不算进正式纪录。",
      focus: "tile",
      wait: "eliminate",
      tipPos: "top"
    },
    {
      id: "done",
      text: "试玩关结束。接下来进入正式游戏，从第 1 波重新开始。",
      focus: "board",
      wait: "next",
      tipPos: "top"
    }
  ],

  isDone() {
    return localStorage.getItem(this.KEY) === "1";
  },

  markDone() {
    localStorage.setItem(this.KEY, "1");
  },

  isActive() {
    return this.active;
  },

  /** 试玩中不让怪物按次数反击 */
  blocksCombat() {
    return this.active || (typeof GameScene !== "undefined" && GameScene.trial);
  },

  shouldStart(data) {
    if (!this.ENABLED) return false;
    if (data && (data.forceTutorial || data.forceTrial || data.trial)) return true;
    if (data && (data.skipTutorial || data.skipTrial)) return false;
    return !this.isDone();
  },

  start() {
    if (!this.ENABLED || this.active) return;
    this.cacheDom();
    this.active = true;
    this.stepIndex = 0;
    if (typeof GameScene !== "undefined") GameScene.trial = true;
    this.overlay.hidden = false;
    document.body.classList.add("is-tutorial");
    this.bind();
    this.showStep();
    if (typeof GameScene !== "undefined" && GameScene.updateHud) GameScene.updateHud();
  },

  end() {
    this.finishTrial();
  },

  /** 中途离开菜单：不标记完成，下次还能进试玩 */
  dismiss(markComplete) {
    this.active = false;
    this.targetEl = null;
    if (this.overlay) this.overlay.hidden = true;
    document.body.classList.remove("is-tutorial");
    this.unbind();
    if (markComplete) this.markDone();
  },

  /** 试玩完成或跳过：记一次，再开正式第 1 波 */
  finishTrial() {
    if (!this.active && !(typeof GameScene !== "undefined" && GameScene.trial)) {
      this.markDone();
      return;
    }
    this.dismiss(true);
    if (typeof GameScene !== "undefined") GameScene.trial = false;
    if (typeof App !== "undefined") {
      App.show("game", { fresh: true, skipTrial: true });
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
    this.onSkip = () => this.finishTrial();
    this.onResize = () => this.refreshFocus();
    this.nextBtn.onclick = this.onNext;
    this.skipBtn.onclick = this.onSkip;
    if (this.skipBtn) this.skipBtn.textContent = "跳过试玩";
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
      this.finishTrial();
      return;
    }
    this.stepEl.textContent = `${this.stepIndex + 1} / ${this.STEPS.length}`;
    this.textEl.textContent = step.text;
    this.nextBtn.hidden = step.wait !== "next";
    this.nextBtn.textContent = step.id === "done" ? "进入正式游戏" : "下一步";
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
      this.finishTrial();
      return;
    }
    this.showStep();
  }
};

window.TutorialGuide = TutorialGuide;
