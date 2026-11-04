// Verbatim user-supplied src/motions.js section. See SOURCE_PROVENANCE.json.
  // src/motions.js
  var CATEGORIES = [
    { id: "companion", name: "日常陪伴", icon: "◎" },
    { id: "movement", name: "移动飞行", icon: "↗" },
    { id: "social", name: "对话交流", icon: "◌" },
    { id: "guidance", name: "指路提示", icon: "→" },
    { id: "emotion", name: "情绪反应", icon: "♡" },
    { id: "exploration", name: "探索互动", icon: "⌕" },
    { id: "combat", name: "遭遇战斗", icon: "⚡" },
    { id: "support", name: "辅助支援", icon: "+" },
    { id: "events", name: "任务事件", icon: "✦" }
  ];
  var definitions = [
    ["idle", "轻轻悬浮", "companion", 4.8, true, "轻微起伏、呼吸与眨眼，安静地陪在身边。", "默认待机、玩家停留、对话间隙。", "◉"],
    ["look", "左右张望", "companion", 5.6, true, "先看左边，再好奇地回头看右边。", "等玩家、观察环境、营造角色生命感。", "⌕"],
    ["sway", "悠闲摇摆", "companion", 4.4, true, "沿柔软的弧线左右荡漾，像空气里的小浮标。", "安全区域、休闲探索、友好陪伴。", "≈"],
    ["bored", "无聊发呆", "companion", 6, true, "慢慢耷拉下来，打个哈欠再提起精神。", "玩家长时间无操作、等待加载。", "…"],
    ["sleep", "打盹睡觉", "companion", 5, true, "闭眼低低漂浮，身体随呼吸缓缓膨胀。", "休息点、夜晚、长时间待机。", "Zz"],
    ["wake", "伸懒腰醒来", "companion", 3.6, false, "先缩成一团，再伸展开来，轻弹一下清醒。", "离开休息点、玩家重新操作。", "☀"],
    ["follow", "轻快跟随", "movement", 3.6, true, "身体微微前倾，飞行时带着轻盈的摆动。", "跟在玩家侧后方；路线由游戏控制。", "↗"],
    ["dash", "蓄力冲刺", "movement", 2.8, false, "先向后蓄势，弹射前冲，再带一点余振。", "快速赶路、追逐、短距离突进。", "»"],
    ["brake", "急刹回稳", "movement", 2.8, false, "身体前冲、压扁、后仰，在惯性里重新稳住。", "抵达目的地、突然停止跟随。", "Ⅱ"],
    ["turn", "转身回望", "movement", 3.2, false, "预备小摆动后转过半圈，再转回来确认玩家。", "查看身后、改变行进方向前的反应。", "↶"],
    ["orbit", "绕身飞行", "movement", 6, true, "沿小小的椭圆绕飞一周，转向与路径同步。", "围绕目标、等待玩家、展示亲近感。", "⟳"],
    ["teleport", "俏皮闪现", "movement", 3.4, false, "缩小蓄力后消失，在一旁出现并弹回原位。", "越过障碍、脱离卡点、瞬移回到玩家身边。", "✧"],
    ["greet", "挥摆打招呼", "social", 3.4, false, "两次轻快跃起，向左右摆动身体打招呼。", "首次见面、玩家上线、交互开始。", "Hi"],
    ["nod", "点头认可", "social", 2.4, false, "一大一小两次点头，带着清晰的压低和回弹。", "确认选择、表示理解、答应请求。", "✓"],
    ["shake", "摇头拒绝", "social", 2.8, false, "左右摇头，再用一个小幅回正结束。", "条件不满足、纠正错误、拒绝操作。", "×"],
    ["talk", "认真说话", "social", 4, true, "随着说话节奏轻点身体，眼睛专注地看向玩家。", "对话气泡、语音台词、提示说明。", "“"],
    ["think", "歪头思考", "social", 4.8, true, "歪着头望向上方，停顿一会儿再轻轻晃动。", "谜题分析、寻找答案、思考下一步。", "?"],
    ["confused", "疑惑不解", "social", 3.8, false, "先歪向一边，再转向另一边，最后短促抬头。", "意外输入、线索矛盾、听不懂玩家的选择。", "?!"],
    ["beckon", "快跟我来", "guidance", 3.8, false, "向玩家靠近，再连着两次向前引领。", "带路、提示入口、邀请玩家开始交互。", "↗"],
    ["point_left", "指向左边", "guidance", 3.2, false, "向左侧探身、倾斜并停留，清楚指出方向。", "左侧路径、目标或交互点。", "←"],
    ["point_right", "指向右边", "guidance", 3.2, false, "向右侧探身、倾斜并停留，清楚指出方向。", "右侧路径、目标或交互点。", "→"],
    ["point_up", "抬头向上", "guidance", 3.2, false, "先压低蓄势，再升高并抬眼看向上方。", "高处入口、攀爬点、天空中的目标。", "↑"],
    ["point_down", "低头向下", "guidance", 3.2, false, "缓缓压低身体并低头，盯住脚下的线索。", "地面物品、下方通道、隐藏机关。", "↓"],
    ["attention", "看这里呀", "guidance", 3, false, "连跳两次吸引注意，第二次更短更俏皮。", "重要提示、新教程、玩家错过目标。", "!"],
    ["happy", "开心蹦跳", "emotion", 3.4, false, "一个大弹跳接一个小弹跳，落下时软软压扁。", "获得好消息、喜欢的互动、愉快反馈。", "♪"],
    ["laugh", "笑得发抖", "emotion", 3.8, false, "仰起身体一阵一阵笑，带着细碎的弹性颤动。", "笑话、搞怪互动、有趣的玩家操作。", "♫"],
    ["shy", "害羞躲闪", "emotion", 4, false, "稍微缩小自己，歪头低眼，再偷偷看回来。", "被夸奖、亲密互动、收到礼物。", "♡"],
    ["sad", "失落叹气", "emotion", 4.6, false, "慢慢沉下一点，垂下目光，叹气后重新振作。", "小失败、遗憾、角色需要安慰。", "…"],
    ["angry", "气鼓鼓", "emotion", 3.8, false, "鼓起身体、低头瞪眼，带着克制的小震动。", "不满、被捉弄、替玩家打抱不平。", "!"],
    ["scared", "吓了一跳", "emotion", 3.4, false, "瞬间弹起后向后缩，发抖几下才稳定下来。", "突发声响、怪物出现、危险机关。", "!"],
    ["curious", "好奇凑近", "exploration", 4, false, "歪着头靠近目标，一边观察一边轻轻换角度。", "发现可交互物、观察陌生事物。", "?"],
    ["search", "来回搜寻", "exploration", 5.4, true, "左右飞行扫视，在端点略作停顿。", "搜索路线、扫描附近物品、寻人。", "⌕"],
    ["discover", "发现宝贝", "exploration", 3.6, false, "先微微停住，再惊喜跃起，闪出小星光。", "发现宝箱、隐藏入口、新线索。", "✦"],
    ["inspect", "绕看检查", "exploration", 5, true, "沿小弧线换角度检查，保持好奇的专注。", "检查装置、观察物品细节、交互预览。", "⊙"],
    ["pickup", "俯冲拾取", "exploration", 3.4, false, "向下探去，轻轻一收，再携着喜悦抬升。", "拾取道具、收集能量、带回小物件。", "+"],
    ["unlock", "解锁机关", "exploration", 4, false, "专注靠近机关，旋转一圈，随后轻弹庆祝。", "开门、解锁、启动装置。", "⌘"],
    ["alert", "危险警戒", "combat", 3.2, true, "略微升高并左右警觉，节奏短促明确。", "附近有敌人、即将触发陷阱。", "!"],
    ["dodge", "侧闪躲避", "combat", 2.6, false, "先虚晃一下，再向左急闪，滑回安全位置。", "躲避攻击、飞行障碍、机关打击。", "↙"],
    ["hit", "受击后退", "combat", 2.8, false, "受到冲击后歪身退开，晃两下重新平衡。", "被击中、碰撞、伤害反馈。", "×"],
    ["shield", "撑起护盾", "combat", 4, true, "稳住身体并鼓起保护场，缓缓脉动。", "保护玩家、格挡、免疫状态。", "◇"],
    ["charge", "集中蓄力", "combat", 3.6, true, "压低身体聚集能量，光点伴随细微颤动。", "施法准备、充能、蓄力技能。", "✧"],
    ["ko", "被击倒", "combat", 4.8, false, "失去平衡后沉下去，短暂停留，再努力恢复。", "战斗失利、受重击、可爱的挫败反馈。", "×"],
    ["heal", "温柔治疗", "support", 4.6, true, "闭眼专注地轻浮，释放一圈圈恢复能量。", "持续治疗、回复生命、安抚同伴。", "+"],
    ["energy", "补充能量", "support", 4, true, "随能量节拍膨胀、抬升，像在给玩家充电。", "恢复体力、提供法力、充能道具。", "ϟ"],
    ["encourage", "给你打气", "support", 3.8, false, "坚定点头后开心跃起，用身体传递鼓励。", "玩家失败后、难关前、连败安慰。", "♡"],
    ["wait", "停下等你", "support", 5.4, true, "停在前方轻轻回望，耐心地点一点头。", "玩家落后、路线分叉、等待交互确认。", "…"],
    ["catchup", "落后追赶", "support", 3.8, false, "先落到一边，再加速追上，冲过一点又回稳。", "玩家突然冲刺、距离过远、跟随追赶。", "»"],
    ["hide", "缩身躲藏", "support", 4.2, false, "缩小身体藏到一旁，偷看后小心探出来。", "潜行、躲避危险、不打扰重要剧情。", "…"],
    ["quest_accept", "收到任务", "events", 3, false, "郑重点头，然后抬起身体表示已经准备好了。", "接受任务、确认指令、绑定新目标。", "✓"],
    ["quest_complete", "任务完成", "events", 4.4, false, "开心升起并转一圈，用星光庆祝完成。", "完成任务、达成阶段目标。", "✓"],
    ["level_up", "升级变强", "events", 4.6, false, "蓄力后向上伸展，能量绽开，再稳稳回落。", "升级、技能解锁、能力强化。", "↑"],
    ["celebrate", "翻滚庆祝", "events", 4.8, false, "高高跃起翻滚一周，落下后再补一个小跳。", "胜利、重要奖励、完成高难度挑战。", "★"],
    ["respawn", "重新出现", "events", 3.8, false, "从小小光点展开，在空中软弹一下进入待机。", "召唤、复活、进入场景、重新连接。", "✧"],
    ["goodbye", "挥摆告别", "events", 4.2, false, "摇摆着道别，轻轻飘远，最后化作微光。", "退出场景、伙伴离队、旅程结束。", "♡"]
  ];
  var ACTIONS = definitions.map(([id, name, category, duration, loop, description, usage, emoji]) => ({ id, name, category, duration, loop, description, usage, emoji }));
  var byId = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
  var ACTION_MAP = byId;
  var TAU = Math.PI * 2;
  var clamp2 = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  var smooth = (v) => {
    const x = clamp2(v);
    return x * x * (3 - 2 * x);
  };
  var smoother = (v) => {
    const x = clamp2(v);
    return x * x * x * (x * (x * 6 - 15) + 10);
  };
  var mix = (a, b, t2) => a + (b - a) * t2;
  var modulo = (x, m) => (x % m + m) % m;
  var window2 = (u2, a = 0.08, b = 0.86, edge = 0.1) => smooth((u2 - a) / edge) * (1 - smooth((u2 - b) / edge));
  var bump = (u2, a, b) => {
    const x = clamp2((u2 - a) / (b - a));
    return Math.sin(Math.PI * x) ** 2;
  };
  var sin = (u2, cycles = 1, phase = 0) => Math.sin(TAU * cycles * u2 + phase);
  function K(u2, keys) {
    if (u2 <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (u2 <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      return mix(a[1], b[1], smoother((u2 - a[0]) / (b[0] - a[0])));
    }
    return keys[keys.length - 1][1];
  }
  function neutral(u2, loop) {
    const e = loop ? 1 : window2(u2, 0, 0.88, 0.12);
    return {
      position: [0, 0.025 * sin(u2) * e, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      eye: "normal",
      mouth: "smile",
      look: [0, 0],
      symbol: "",
      effect: "none",
      effectAmount: 0,
      opacity: 1,
      phase: loop ? "循环" : u2 < 0.16 ? "预备" : u2 < 0.66 ? "主动作" : u2 < 0.86 ? "余振" : "回稳"
    };
  }
  function stretch(p, value, axis = 1) {
    const v = Math.max(0.05, value), side = 1 / Math.sqrt(v);
    p.scale = [side, side, side];
    p.scale[axis] = v;
  }
  function effect(p, type, amount = 1) {
    p.effect = type;
    p.effectAmount = clamp2(amount);
  }
  function face(p, eye, mouth = "smile") {
    p.eye = eye;
    p.mouth = mouth;
  }
  function symbol(p, text, u2, a = 0.18, b = 0.82) {
    if (u2 >= a && u2 <= b) p.symbol = text;
  }
  var arcKeys = [[0, 0], [0.12, -0.12], [0.36, 0.62], [0.58, -0.08], [0.74, 0.24], [0.88, -0.025], [1, 0]];
  function sampleMotion(id, t2, options = {}) {
    const a = byId[id] || byId.idle;
    const time = Number.isFinite(t2) ? Math.max(0, t2) : 0;
    const u2 = a.loop ? modulo(time, a.duration) / a.duration : clamp2(time / a.duration);
    const p = neutral(u2, a.loop), e = window2(u2, 0, 0.87, 0.13);
    const w = window2(u2, 0.06, 0.82, 0.12);
    const at = (keys) => K(u2, keys);
    switch (a.id) {
      case "idle": {
        p.position = [0.035 * sin(u2), 0.105 * sin(u2), 0.025 * sin(u2, 2)];
        p.rotation = [0.035 * sin(u2), 0.04 * sin(u2), 0.035 * sin(u2, 1, 0.5)];
        stretch(p, 1 + 0.018 * sin(u2));
        p.look = [0.1 * sin(u2), 0.04 * sin(u2, 2)];
        if (u2 > 0.69 && u2 < 0.715) p.eye = "closed";
        p.phase = "轻轻呼吸";
        break;
      }
      case "look": {
        const gaze = at([[0, 0], [0.12, -1], [0.32, -1], [0.46, 0.15], [0.58, 1], [0.77, 1], [1, 0]]);
        p.position = [0.07 * gaze, 0.075 * sin(u2), 0];
        p.rotation = [0.02, 0.55 * gaze, -0.075 * gaze];
        p.look = [gaze, 0.06];
        p.phase = u2 < 0.4 ? "看看左边" : u2 < 0.8 ? "看看右边" : "回望玩家";
        break;
      }
      case "sway": {
        p.position = [0.4 * sin(u2), 0.09 * sin(u2, 2), 0.035 * sin(u2)];
        p.rotation = [0, 0.15 * sin(u2), -0.22 * sin(u2)];
        face(p, "happy");
        p.phase = "自在摇摆";
        break;
      }
      case "bored": {
        const slump = at([[0, 0], [0.22, 1], [0.5, 1], [0.64, 0.6], [0.78, 0], [1, 0]]);
        p.position[1] = -0.2 * slump + 0.045 * sin(u2, 2);
        p.rotation = [0.15 * slump, 0, 0.1 * slump];
        stretch(p, 1 - 0.08 * slump);
        p.look = [0, -0.3 * slump];
        if (u2 > 0.26 && u2 < 0.66) {
          face(p, "closed", "open");
          p.symbol = "…";
        }
        p.phase = u2 < 0.58 ? "有点无聊" : "重新打起精神";
        break;
      }
      case "sleep": {
        p.position = [0.025 * sin(u2), -0.18 + 0.055 * sin(u2), 0];
        p.rotation = [0.14, 0.03 * sin(u2), 0.1 + 0.025 * sin(u2)];
        stretch(p, 1 + 0.045 * sin(u2));
        face(p, "closed", "small");
        p.symbol = "Zz";
        effect(p, "sleep", 0.6 + 0.2 * sin(u2));
        p.phase = "呼吸 · 休息";
        break;
      }
      case "wake": {
        p.position[1] = at([[0, 0], [0.18, -0.23], [0.4, 0.35], [0.57, 0.2], [0.72, -0.08], [0.87, 0.1], [1, 0]]);
        stretch(p, at([[0, 1], [0.18, 0.8], [0.4, 1.28], [0.6, 1.03], [0.73, 0.91], [1, 1]]));
        p.rotation[2] = 0.12 * sin(u2) * e;
        face(p, u2 < 0.37 ? "closed" : u2 < 0.62 ? "wide" : "happy", u2 < 0.5 ? "open" : "smile");
        symbol(p, "☀", u2, 0.44, 0.85);
        p.phase = u2 < 0.35 ? "伸懒腰" : u2 < 0.7 ? "清醒了" : "轻轻回稳";
        break;
      }
      case "follow": {
        p.position = [0.26 * sin(u2), 0.09 * sin(u2, 2), 0.06 * sin(u2)];
        p.rotation = [0.14 + 0.04 * sin(u2, 2), 0.15 * sin(u2), -0.12 * sin(u2)];
        stretch(p, 1 + 0.025 * sin(u2, 2));
        effect(p, "speed", 0.2);
        p.phase = "轻快跟随";
        break;
      }
      case "dash": {
        p.position = [at([[0, 0], [0.2, -0.38], [0.39, 1.72], [0.55, 1.88], [0.78, 0.28], [1, 0]]), at([[0, 0], [0.2, -0.1], [0.38, 0.13], [0.57, 0.05], [0.82, 0.11], [1, 0]]), 0];
        p.rotation = [0, at([[0, 0], [0.2, -0.12], [0.4, 0.5], [0.56, 0.35], [1, 0]]), at([[0, 0], [0.2, 0.23], [0.35, -0.52], [0.55, 0.24], [0.78, -0.09], [1, 0]])];
        stretch(p, at([[0, 1], [0.2, 0.78], [0.34, 1.5], [0.51, 0.85], [0.7, 1.05], [1, 1]]), 0);
        effect(p, "speed", bump(u2, 0.21, 0.65));
        face(p, u2 > 0.22 && u2 < 0.52 ? "wide" : "normal");
        p.phase = u2 < 0.22 ? "向后蓄势" : u2 < 0.48 ? "加速冲出" : u2 < 0.7 ? "减速" : "回稳";
        break;
      }
      case "brake": {
        p.position[0] = at([[0, 0], [0.22, 0.85], [0.38, 0.94], [0.55, 0.52], [0.72, 0.63], [1, 0]]);
        p.position[1] = at([[0, 0], [0.22, 0.02], [0.38, -0.13], [0.55, 0.14], [0.77, -0.025], [1, 0]]);
        p.rotation[2] = at([[0, 0], [0.18, -0.33], [0.38, 0.5], [0.6, -0.16], [0.78, 0.07], [1, 0]]);
        stretch(p, at([[0, 1], [0.21, 1.18], [0.38, 0.78], [0.56, 1.08], [0.75, 0.97], [1, 1]]), 0);
        face(p, u2 < 0.45 ? "wide" : "normal", u2 < 0.45 ? "open" : "smile");
        effect(p, "speed", bump(u2, 0, 0.45) * 0.6);
        break;
      }
      case "turn": {
        p.rotation[1] = at([[0, 0], [0.13, 0.18], [0.4, -Math.PI - 0.14], [0.6, -Math.PI], [0.85, -TAU - 0.08], [1, -TAU]]);
        p.rotation[2] = at([[0, 0], [0.14, -0.09], [0.36, 0.15], [0.6, 0], [0.84, 0.08], [1, 0]]);
        p.position[1] = 0.14 * bump(u2, 0.12, 0.6) + 0.08 * bump(u2, 0.64, 1);
        p.look = [-0.5 * e, 0];
        p.phase = u2 < 0.45 ? "转身" : u2 < 0.66 ? "确认身后" : "回望玩家";
        break;
      }
      case "orbit": {
        p.position = [1 * sin(u2), 0.12 * sin(u2, 2), 0.58 * Math.cos(TAU * u2)];
        p.rotation = [0.06, -TAU * u2, -0.16 * sin(u2)];
        p.phase = "绕目标飞行";
        break;
      }
      case "teleport": {
        const size = at([[0, 1], [0.16, 0.84], [0.3, 1.08], [0.4, 0.025], [0.53, 0.025], [0.64, 1.2], [0.77, 0.9], [1, 1]]);
        p.scale = [size, size, size];
        p.opacity = at([[0, 1], [0.33, 1], [0.41, 0], [0.53, 0], [0.6, 1], [1, 1]]);
        p.position = [at([[0, 0], [0.4, 0], [0.52, 1.4], [0.7, 1.4], [0.85, 0.3], [1, 0]]), at([[0, 0], [0.3, -0.1], [0.53, 0.2], [0.66, 0.4], [0.86, 0.06], [1, 0]]), 0];
        p.rotation[2] = 0.16 * sin(u2, 2) * e;
        effect(p, "burst", bump(u2, 0.29, 0.48) + bump(u2, 0.53, 0.78));
        face(p, "happy");
        p.phase = u2 < 0.35 ? "缩成光点" : u2 < 0.55 ? "闪现" : u2 < 0.76 ? "出现" : "回稳";
        break;
      }
      case "greet": {
        p.position = [0.12 * sin(u2, 2) * e, at(arcKeys), 0];
        p.rotation[2] = 0.32 * sin(u2, 3) * w;
        stretch(p, 1 + 0.13 * sin(u2, 3) * e);
        face(p, u2 > 0.42 && u2 < 0.65 ? "wink" : "happy");
        symbol(p, "Hi", u2);
        effect(p, "sparkle", 0.45 * w);
        break;
      }
      case "nod": {
        const n2 = at([[0, 0], [0.12, -0.12], [0.3, 0.44], [0.45, -0.13], [0.64, 0.27], [0.79, -0.04], [1, 0]]);
        p.rotation[0] = n2;
        p.position[1] = -0.3 * Math.max(0, n2);
        stretch(p, 1 - 0.12 * Math.max(0, n2));
        p.look = [0, -0.3 * e];
        symbol(p, "✓", u2, 0.4, 0.82);
        break;
      }
      case "shake": {
        const n2 = at([[0, 0], [0.13, 0.12], [0.29, -0.56], [0.45, 0.5], [0.61, -0.32], [0.76, 0.17], [1, 0]]);
        p.rotation = [0, n2, -n2 * 0.12];
        p.position[0] = n2 * 0.08;
        p.look = [n2 * 0.7, 0];
        p.mouth = "flat";
        symbol(p, "×", u2);
        break;
      }
      case "talk": {
        p.position[1] = 0.06 * sin(u2, 3);
        p.rotation = [0.045 * sin(u2, 3), 0.06 * sin(u2), 0.055 * sin(u2, 2)];
        stretch(p, 1 + 0.018 * sin(u2, 3));
        p.mouth = sin(u2, 7) > 0.12 ? "open" : "small";
        p.look = [0.06 * sin(u2), 0.05];
        p.phase = "正在说话";
        break;
      }
      case "think": {
        const tilt = at([[0, 0], [0.22, 1], [0.64, 1], [0.8, 0.7], [1, 0]]);
        p.rotation = [-0.08 * tilt, 0.16 * tilt, 0.25 * tilt];
        p.position[1] = 0.045 * sin(u2);
        p.look = [0.45 * tilt, 0.75 * tilt];
        p.mouth = "small";
        symbol(p, "?", u2, 0.22, 0.78);
        p.phase = "让我想想";
        break;
      }
      case "confused": {
        p.rotation[2] = at([[0, 0], [0.2, 0.3], [0.4, 0.3], [0.6, -0.35], [0.77, -0.25], [1, 0]]);
        p.rotation[1] = 0.12 * sin(u2) * e;
        p.position[1] = 0.12 * bump(u2, 0.63, 0.91);
        p.look = [0.6 * sin(u2) * e, 0.2 * e];
        face(p, "wide", "small");
        symbol(p, "?", u2);
        break;
      }
      case "beckon": {
        p.position[2] = at([[0, 0], [0.17, 0.43], [0.35, -0.18], [0.5, 0.25], [0.68, -0.24], [1, 0]]);
        p.position[1] = 0.12 * bump(u2, 0.1, 0.42) + 0.1 * bump(u2, 0.43, 0.76);
        p.rotation[0] = at([[0, 0], [0.18, -0.18], [0.34, 0.27], [0.5, -0.12], [0.68, 0.23], [1, 0]]);
        p.rotation[2] = 0.09 * sin(u2, 2) * e;
        face(p, "happy");
        symbol(p, "↗", u2);
        break;
      }
      case "point_left":
      case "point_right": {
        const dir = a.id === "point_left" ? -1 : 1;
        const reach = at([[0, 0], [0.14, -0.14], [0.38, 1.08], [0.54, 1], [0.73, 1], [1, 0]]);
        p.position = [dir * 0.7 * reach, 0.12 * reach, 0];
        p.rotation = [0, dir * 0.3 * reach, -dir * 0.36 * reach];
        p.look = [dir * reach, 0.1];
        symbol(p, dir < 0 ? "←" : "→", u2, 0.25, 0.84);
        break;
      }
      case "point_up": {
        const reach = at([[0, 0], [0.16, -0.22], [0.4, 0.86], [0.57, 0.75], [0.75, 0.75], [1, 0]]);
        p.position[1] = reach;
        p.rotation[0] = -0.34 * Math.max(0, reach);
        p.look = [0, 0.9 * e];
        stretch(p, 1 + 0.13 * bump(u2, 0.2, 0.6));
        symbol(p, "↑", u2, 0.27, 0.85);
        break;
      }
      case "point_down": {
        const reach = at([[0, 0], [0.18, 0.13], [0.43, -0.5], [0.62, -0.43], [0.77, -0.43], [1, 0]]);
        p.position[1] = reach;
        p.rotation[0] = -0.75 * reach;
        p.look = [0, -0.9 * e];
        p.rotation[2] = 0.07 * e;
        symbol(p, "↓", u2, 0.27, 0.85);
        break;
      }
      case "attention": {
        p.position[1] = at([[0, 0], [0.13, -0.14], [0.31, 0.7], [0.47, -0.1], [0.62, 0.37], [0.78, -0.04], [1, 0]]);
        stretch(p, at([[0, 1], [0.13, 0.8], [0.26, 1.22], [0.46, 0.85], [0.58, 1.13], [0.77, 0.95], [1, 1]]));
        p.rotation[2] = 0.12 * sin(u2, 3) * e;
        face(p, "wide");
        symbol(p, "!", u2, 0.2, 0.85);
        effect(p, "alert", 0.65 * w);
        break;
      }
      case "happy": {
        p.position[1] = at(arcKeys);
        p.position[0] = 0.12 * sin(u2) * e;
        p.rotation[2] = 0.25 * sin(u2, 2) * e;
        stretch(p, at([[0, 1], [0.12, 0.82], [0.27, 1.19], [0.43, 1.02], [0.58, 0.86], [0.72, 1.09], [1, 1]]));
        face(p, "happy");
        symbol(p, "♪", u2);
        effect(p, "sparkle", 0.55 * w);
        break;
      }
      case "laugh": {
        const laugh = window2(u2, 0.12, 0.75, 0.15);
        p.position = [0.045 * sin(u2, 9) * laugh, 0.09 * Math.abs(sin(u2, 5)) * laugh, 0];
        p.rotation = [-0.17 * laugh, 0, 0.065 * sin(u2, 5) * laugh];
        stretch(p, 1 + 0.075 * sin(u2, 5) * laugh);
        face(p, u2 > 0.15 && u2 < 0.86 ? "happy" : "normal", u2 > 0.15 && u2 < 0.86 ? "open" : "smile");
        symbol(p, "♫", u2, 0.24, 0.81);
        break;
      }
      case "shy": {
        const shy = at([[0, 0], [0.25, 1], [0.63, 1], [0.8, 0.5], [1, 0]]);
        p.position = [0.16 * shy, -0.12 * shy, -0.09 * shy];
        p.rotation = [0.18 * shy, 0.13 * shy, -0.24 * shy];
        const s = 1 - 0.055 * shy;
        p.scale = [s, s, s];
        p.look = [-0.45 * shy, -0.6 * shy];
        face(p, u2 > 0.23 && u2 < 0.55 ? "closed" : "normal", "small");
        effect(p, "heart", 0.65 * shy);
        break;
      }
      case "sad": {
        const low = at([[0, 0], [0.25, 0.85], [0.5, 1], [0.72, 0.8], [1, 0]]);
        p.position = [-0.07 * low, -0.28 * low, 0];
        p.rotation = [0.24 * low, 0, 0.15 * low];
        stretch(p, 1 - 0.1 * low);
        p.look = [0, -0.75 * low];
        face(p, low > 0.2 ? "sad" : "normal", low > 0.2 ? "sad" : "smile");
        symbol(p, "…", u2, 0.3, 0.74);
        p.phase = u2 < 0.3 ? "失落" : u2 < 0.75 ? "轻轻叹气" : "重新振作";
        break;
      }
      case "angry": {
        const mad = window2(u2, 0.12, 0.75, 0.15);
        p.position = [0.035 * sin(u2, 13) * mad, 0.04 * sin(u2, 4) * mad, 0];
        p.rotation = [0.14 * mad, 0, 0.04 * sin(u2, 7) * mad];
        p.scale = [1 + 0.075 * mad, 1 - 0.04 * mad, 1 + 0.055 * mad];
        face(p, mad > 0.2 ? "angry" : "normal", mad > 0.2 ? "flat" : "smile");
        symbol(p, "!", u2, 0.3, 0.75);
        effect(p, "alert", 0.45 * mad);
        break;
      }
      case "scared": {
        const tremble = window2(u2, 0.3, 0.7, 0.1);
        p.position = [
          at([[0, 0], [0.19, 0.08], [0.31, -0.5], [0.69, -0.4], [1, 0]]) + 0.045 * sin(u2, 15) * tremble,
          at([[0, 0], [0.16, -0.03], [0.26, 0.6], [0.4, 0.28], [0.72, 0.1], [1, 0]]),
          -0.3 * e
        ];
        p.rotation[2] = -0.13 * e + 0.05 * sin(u2, 11) * tremble;
        stretch(p, at([[0, 1], [0.18, 0.9], [0.26, 1.28], [0.4, 0.87], [0.7, 0.96], [1, 1]]));
        face(p, "wide", "open");
        symbol(p, "!", u2, 0.2, 0.7);
        break;
      }
      case "curious": {
        const near = at([[0, 0], [0.3, 1], [0.67, 1], [1, 0]]);
        p.position = [0.08 * sin(u2) * near, 0.1 * near, 0.52 * near];
        p.rotation = [-0.08 * near, 0.16 * sin(u2) * near, 0.3 * near];
        p.look = [0.28 * sin(u2), 0.18 * near];
        p.mouth = "small";
        symbol(p, "?", u2, 0.35, 0.72);
        break;
      }
      case "search": {
        const sweep = sin(u2);
        p.position = [0.65 * sweep, 0.055 * sin(u2, 2), 0];
        p.rotation = [0.08, 0.48 * sweep, -0.12 * sweep];
        p.look = [sweep, -0.18];
        p.mouth = "small";
        effect(p, "scan", 0.65);
        p.phase = "扫视附近";
        break;
      }
      case "discover": {
        p.position[1] = at([[0, 0], [0.24, -0.12], [0.38, 0.58], [0.56, 0.25], [0.72, 0.38], [1, 0]]);
        p.rotation[2] = at([[0, 0], [0.24, 0.17], [0.38, -0.13], [0.6, 0.1], [1, 0]]);
        stretch(p, at([[0, 1], [0.24, 0.88], [0.36, 1.2], [0.52, 0.95], [1, 1]]));
        face(p, u2 < 0.3 ? "normal" : u2 < 0.6 ? "wide" : "happy");
        symbol(p, "✦", u2, 0.35, 0.84);
        effect(p, "sparkle", window2(u2, 0.31, 0.8, 0.13));
        break;
      }
      case "inspect": {
        p.position = [0.55 * sin(u2), 0.08 * sin(u2, 2), 0.22 * Math.cos(TAU * u2)];
        p.rotation = [0.12, 0.48 * sin(u2), 0.18 * sin(u2)];
        p.look = [-0.45 * sin(u2), -0.23];
        p.mouth = "small";
        effect(p, "scan", 0.35);
        p.phase = "换个角度看看";
        break;
      }
      case "pickup": {
        p.position = [0.12 * sin(u2) * e, at([[0, 0], [0.17, 0.1], [0.4, -0.58], [0.5, -0.6], [0.69, 0.33], [0.86, 0.08], [1, 0]]), 0.25 * bump(u2, 0.15, 0.85)];
        p.rotation[0] = at([[0, 0], [0.2, 0.1], [0.42, 0.5], [0.54, 0.2], [0.7, -0.15], [1, 0]]);
        stretch(p, at([[0, 1], [0.34, 1.06], [0.46, 0.85], [0.63, 1.16], [0.82, 0.97], [1, 1]]));
        face(p, u2 > 0.6 ? "happy" : "normal");
        symbol(p, "+", u2, 0.58, 0.89);
        effect(p, "sparkle", bump(u2, 0.48, 0.98));
        break;
      }
      case "unlock": {
        p.position[2] = 0.28 * window2(u2, 0.1, 0.62, 0.15);
        p.position[1] = 0.28 * bump(u2, 0.5, 0.9);
        p.rotation[1] = at([[0, 0], [0.22, -0.18], [0.59, TAU + 0.08], [0.75, TAU], [1, TAU]]);
        p.rotation[2] = 0.08 * sin(u2, 2) * e;
        face(p, u2 > 0.55 ? "happy" : "normal");
        symbol(p, "✓", u2, 0.61, 0.91);
        effect(p, "burst", bump(u2, 0.53, 0.91));
        p.phase = u2 < 0.25 ? "靠近机关" : u2 < 0.6 ? "正在解锁" : "解锁成功";
        break;
      }
      case "alert": {
        p.position = [0.04 * sin(u2, 4), 0.16 + 0.06 * sin(u2, 2), 0];
        p.rotation = [-0.035, 0.2 * sin(u2), 0.035 * sin(u2, 4)];
        p.look = [0.7 * sin(u2), 0.1];
        face(p, "wide", "small");
        p.symbol = "!";
        effect(p, "alert", 0.65 + 0.3 * (0.5 + 0.5 * sin(u2, 2)));
        p.phase = "发现危险";
        break;
      }
      case "dodge": {
        p.position = [at([[0, 0], [0.16, 0.18], [0.35, -1.55], [0.52, -1.4], [0.76, -0.2], [1, 0]]), at([[0, 0], [0.16, -0.08], [0.36, 0.3], [0.62, 0.16], [1, 0]]), -0.15 * bump(u2, 0.2, 0.75)];
        p.rotation[2] = at([[0, 0], [0.16, -0.16], [0.34, 0.65], [0.54, 0.22], [0.78, -0.1], [1, 0]]);
        stretch(p, at([[0, 1], [0.17, 0.84], [0.3, 1.32], [0.48, 1.05], [0.65, 0.94], [1, 1]]), 0);
        face(p, "wide", "small");
        effect(p, "speed", bump(u2, 0.17, 0.68));
        break;
      }
      case "hit": {
        p.position = [at([[0, 0], [0.15, 0], [0.3, 0.9], [0.48, 0.7], [0.7, 0.2], [1, 0]]), at([[0, 0], [0.15, 0], [0.3, -0.22], [0.5, 0.08], [0.7, -0.03], [1, 0]]), -0.1 * e];
        p.rotation[2] = at([[0, 0], [0.15, 0], [0.28, -0.68], [0.48, 0.24], [0.67, -0.1], [1, 0]]);
        stretch(p, at([[0, 1], [0.16, 1], [0.25, 0.76], [0.38, 1.12], [0.58, 0.96], [1, 1]]), 0);
        face(p, u2 > 0.17 && u2 < 0.5 ? "closed" : "wide", u2 > 0.17 && u2 < 0.5 ? "flat" : "small");
        symbol(p, "×", u2, 0.2, 0.55);
        effect(p, "burst", bump(u2, 0.14, 0.39) * 0.65);
        p.opacity = u2 > 0.22 && u2 < 0.6 ? 0.72 + 0.28 * Math.abs(sin(u2, 9)) : 1;
        break;
      }
      case "shield": {
        p.position[1] = 0.07 * sin(u2);
        p.rotation = [-0.04, 0, 0.025 * sin(u2)];
        stretch(p, 1 + 0.025 * sin(u2));
        p.look = [0, 0.1];
        effect(p, "shield", 0.86 + 0.1 * sin(u2));
        p.phase = "守护中";
        break;
      }
      case "charge": {
        p.position = [0.018 * sin(u2, 12), -0.12 + 0.06 * sin(u2, 2), 0];
        p.rotation = [0.08, 0.025 * sin(u2, 3), 0.025 * sin(u2, 8)];
        stretch(p, 0.94 + 0.055 * sin(u2, 2));
        face(p, "closed", "flat");
        effect(p, "sparkle", 0.75 + 0.2 * sin(u2, 2));
        p.symbol = "✧";
        p.phase = "能量聚集";
        break;
      }
      case "ko": {
        const down = at([[0, 0], [0.13, -0.1], [0.38, 1.05], [0.7, 1], [0.9, 0.24], [1, 0]]);
        p.position = [0.25 * down, -0.62 * down, -0.1 * down];
        p.rotation = [0.12 * down, 0, 1.35 * down];
        stretch(p, 1 - 0.13 * Math.max(0, down));
        face(p, down > 0.3 ? "closed" : "normal", down > 0.3 ? "flat" : "small");
        symbol(p, "×", u2, 0.3, 0.79);
        p.phase = u2 < 0.3 ? "失去平衡" : u2 < 0.76 ? "倒下了" : "努力恢复";
        break;
      }
      case "heal": {
        p.position = [0.025 * sin(u2), 0.08 + 0.065 * sin(u2), 0];
        p.rotation = [-0.06, 0, 0.035 * sin(u2)];
        stretch(p, 1 + 0.025 * sin(u2));
        face(p, "closed");
        effect(p, "heal", 0.75 + 0.2 * sin(u2));
        p.symbol = "+";
        p.phase = "持续恢复";
        break;
      }
      case "energy": {
        p.position[1] = 0.14 + 0.13 * sin(u2, 2);
        stretch(p, 1 + 0.07 * sin(u2, 2));
        p.rotation[2] = 0.07 * sin(u2);
        face(p, "happy");
        effect(p, "sparkle", 0.65 + 0.3 * sin(u2, 2));
        p.symbol = "ϟ";
        p.phase = "补充能量";
        break;
      }
      case "encourage": {
        p.position[1] = at([[0, 0], [0.16, -0.12], [0.3, 0.04], [0.42, -0.06], [0.6, 0.47], [0.8, -0.04], [1, 0]]);
        p.rotation[0] = 0.33 * bump(u2, 0.08, 0.35);
        p.rotation[2] = 0.16 * sin(u2, 2) * e;
        stretch(p, 1 + 0.08 * sin(u2, 3) * e);
        face(p, "happy");
        symbol(p, "♡", u2, 0.45, 0.88);
        effect(p, "heart", 0.6 * window2(u2, 0.4, 0.8, 0.15));
        break;
      }
      case "wait": {
        const turn = at([[0, 0], [0.23, 0.35], [0.44, 0.35], [0.7, -0.15], [1, 0]]);
        p.position = [0.03 * sin(u2), 0.055 * sin(u2), 0];
        p.rotation = [0.055 * sin(u2, 2), turn, 0.05 * sin(u2)];
        p.look = [-0.4 * turn, 0];
        symbol(p, "…", u2, 0.34, 0.65);
        p.phase = "耐心等你";
        break;
      }
      case "catchup": {
        p.position = [at([[0, 0], [0.22, -1.55], [0.37, -1.6], [0.61, 0.65], [0.76, -0.15], [1, 0]]), at([[0, 0], [0.25, -0.16], [0.58, 0.25], [0.76, 0.04], [1, 0]]), 0];
        p.rotation[2] = at([[0, 0], [0.2, 0.15], [0.4, -0.42], [0.61, -0.25], [0.75, 0.2], [1, 0]]);
        stretch(p, 1 + 0.25 * bump(u2, 0.36, 0.68), 0);
        effect(p, "speed", bump(u2, 0.28, 0.76));
        face(p, u2 < 0.65 ? "wide" : "happy");
        p.phase = u2 < 0.35 ? "落后了" : u2 < 0.68 ? "快快追上" : "我来啦";
        break;
      }
      case "hide": {
        const h = at([[0, 0], [0.27, 1], [0.57, 1], [0.73, 0.7], [1, 0]]);
        p.position = [-0.9 * h, -0.16 * h, -0.45 * h];
        const s = 1 - 0.28 * h;
        p.scale = [s, s, s];
        p.rotation = [0.08 * h, -0.18 * h, 0.16 * h];
        p.look = [0.8 * h, 0.08];
        face(p, "wide", "small");
        p.opacity = 1 - 0.2 * h;
        symbol(p, "…", u2, 0.3, 0.6);
        p.phase = u2 < 0.3 ? "躲到一旁" : u2 < 0.65 ? "偷偷观察" : "慢慢探出";
        break;
      }
      case "quest_accept": {
        p.rotation[0] = at([[0, 0], [0.16, -0.1], [0.35, 0.35], [0.5, -0.08], [1, 0]]);
        p.position[1] = at([[0, 0], [0.34, -0.13], [0.58, 0.22], [0.8, 0.08], [1, 0]]);
        stretch(p, 1 + 0.06 * bump(u2, 0.4, 0.8));
        face(p, "happy");
        symbol(p, "✓", u2, 0.4, 0.87);
        effect(p, "sparkle", 0.55 * bump(u2, 0.35, 0.95));
        break;
      }
      case "quest_complete": {
        p.position[1] = at([[0, 0], [0.15, -0.17], [0.45, 0.9], [0.63, 0.58], [0.82, -0.04], [1, 0]]);
        p.rotation[1] = at([[0, 0], [0.2, -0.18], [0.64, TAU + 0.12], [0.81, TAU], [1, TAU]]);
        p.rotation[2] = 0.1 * sin(u2) * e;
        stretch(p, at([[0, 1], [0.15, 0.82], [0.32, 1.18], [0.6, 1], [0.81, 0.9], [1, 1]]));
        face(p, "happy");
        symbol(p, "✓", u2, 0.42, 0.9);
        effect(p, "sparkle", window2(u2, 0.3, 0.83, 0.15));
        break;
      }
      case "level_up": {
        const rise = at([[0, 0], [0.23, -0.2], [0.52, 1.04], [0.7, 0.8], [0.9, 0.06], [1, 0]]);
        p.position[1] = rise;
        p.rotation[1] = at([[0, 0], [0.25, 0], [0.68, TAU], [1, TAU]]);
        const s = at([[0, 1], [0.23, 0.85], [0.49, 1.22], [0.7, 1.12], [1, 1]]);
        p.scale = [s, s, s];
        face(p, u2 < 0.3 ? "closed" : "happy");
        symbol(p, "↑", u2, 0.42, 0.86);
        effect(p, "burst", window2(u2, 0.31, 0.8, 0.15));
        p.phase = u2 < 0.3 ? "积蓄力量" : u2 < 0.68 ? "升级绽放" : "获得新能力";
        break;
      }
      case "celebrate": {
        p.position = [0.12 * sin(u2) * e, at([[0, 0], [0.12, -0.2], [0.39, 1.12], [0.62, -0.13], [0.77, 0.38], [0.9, -0.025], [1, 0]]), 0];
        p.rotation[2] = at([[0, 0], [0.17, -0.2], [0.53, TAU + 0.1], [0.65, TAU], [0.8, TAU + 0.12], [1, TAU]]);
        stretch(p, at([[0, 1], [0.12, 0.8], [0.28, 1.2], [0.47, 1], [0.62, 0.8], [0.75, 1.12], [1, 1]]));
        face(p, "happy", "open");
        symbol(p, "★", u2, 0.35, 0.87);
        effect(p, "burst", window2(u2, 0.23, 0.83, 0.12));
        break;
      }
      case "respawn": {
        const s = at([[0, 0.02], [0.13, 0.02], [0.4, 1.23], [0.55, 0.88], [0.7, 1.05], [1, 1]]);
        p.scale = [s, s, s];
        p.opacity = at([[0, 0], [0.12, 0], [0.32, 1], [1, 1]]);
        p.position[1] = at([[0, -0.22], [0.2, -0.15], [0.42, 0.32], [0.58, -0.08], [0.73, 0.1], [1, 0]]);
        p.rotation[1] = at([[0, -Math.PI], [0.16, -Math.PI], [0.48, 0.1], [0.66, 0], [1, 0]]);
        face(p, u2 < 0.4 ? "closed" : "happy");
        effect(p, "burst", bump(u2, 0.12, 0.69));
        p.phase = u2 < 0.28 ? "光点凝聚" : u2 < 0.62 ? "重新出现" : "准备好了";
        break;
      }
      case "goodbye": {
        const wave = window2(u2, 0.04, 0.47, 0.13);
        p.rotation[2] = 0.3 * sin(u2, 4) * wave;
        p.position[1] = at([[0, 0], [0.24, 0.18], [0.5, 0.16], [0.82, 0.68], [1, 0.74]]);
        p.position[2] = at([[0, 0], [0.5, 0], [1, -0.7]]);
        p.opacity = at([[0, 1], [0.68, 1], [0.94, 0], [1, 0]]);
        const s = at([[0, 1], [0.6, 1], [1, 0.45]]);
        p.scale = [s, s, s];
        face(p, "happy");
        symbol(p, "♡", u2, 0.14, 0.64);
        effect(p, "sparkle", window2(u2, 0.6, 0.86, 0.12));
        p.phase = u2 < 0.55 ? "挥摆道别" : "下次再见";
        break;
      }
    }
    p.unwrappedRotation = p.rotation.slice(); // Retain full turns for the internal front-plane channel.
    p.rotation = p.rotation.map((v) => Math.atan2(Math.sin(v), Math.cos(v)));
    return p;
  }
  var EVENT_ACTIONS = {
    idle: "idle",
    player_move: "follow",
    player_sprint: "catchup",
    player_stop: "brake",
    interact: "greet",
    dialogue: "talk",
    thinking: "think",
    confirm: "nod",
    deny: "shake",
    lead_player: "beckon",
    objective_found: "discover",
    danger: "alert",
    damage: "hit",
    dodge: "dodge",
    shield: "shield",
    heal: "heal",
    low_health: "scared",
    defeated: "ko",
    collect: "pickup",
    unlocked: "unlock",
    quest_accepted: "quest_accept",
    quest_completed: "quest_complete",
    level_up: "level_up",
    victory: "celebrate",
    respawn: "respawn",
    player_afk: "bored",
    rest: "sleep",
    wake: "wake",
    goodbye: "goodbye"
  };


export {ACTIONS,CATEGORIES,ACTION_MAP,EVENT_ACTIONS,sampleMotion};
