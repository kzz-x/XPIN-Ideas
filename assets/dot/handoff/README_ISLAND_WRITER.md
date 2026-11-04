# Dot D r02 正式采用共享组件 r01

模型决定：用户已接受 D 融合 r02 六瓣轮廓、正侧眼睛和 A 材质/帽子/小号形变，正式用于所有 Dot 场景。本包是该模型的独立冻结分发；原 r02、旧 canonical、旧舞台不覆盖。

## 精确入口

`index.mjs` → `loadSharedDot`（别名 loadAcceptedDot / loadCanonicalDot）。
acceptedId: `Dot/D02/ACCEPTED/20261031`。
`ACCEPTED_MODEL_LOCK.json` 锁 35 个 model 原文件。所有 model 文件与接受源逐字节一致。运行适配在 runtime，恢复效果在 effects；不能把旧 fusion-runtime 的 opacity 退场用于正式舞台。

## 推荐岛端接口（原 writer 接入，不跨写）

```js
import {loadSharedDot, sampleMotion, ACCEPTED_ID} from './shared-dot/index.mjs';
const rig = await loadSharedDot({
  camera, scene, coordinates:'normalized', context:'normal',
  asset: embeddedGLBDataURI // 或合法可读取的 GLB URL；是字符串/URL，不是函数
});
actorPlacement.add(rig.root); // 世界位置/基础尺度由场景负责
rig.samplePose('idle', elapsed, {bindEyes:false});
// 此后完成宿主 actorPlacement、相机、投影桥接的全部变化。
rig.faceCamera(camera);
rig.finalizeEyes();
```

直接 `samplePose(actionId,t)` 支持 9 类接受姿态及原库 54 动作。以秒为绝对采样；无内部 RAF，无全局 GSAP ticker 修改。外部 effect metadata 由场景呈现，不凭接口存在称所有场景已验。

推荐新接入只选一种更新路径。旧岛控制器可保留 `rig.dot.retargetMotion(sample,{id,dt,reduced})` → 宿主写 `motionRoot` → `rig.update(seconds,{bindEyes:false})` → 完成世界变换 → `faceCamera/finalizeEyes`。retargetMotion 直接消费 sample，内部漂移/尺度清零，避免宿主动作被叠两次。旧 viewer 的 `applyRootSample` 只在 motionRoot 施加一次外层移动/允许的统一缩放；其后 actor.update 不再采 idle 覆盖。

## 坐标和眼睛

- native：A 原生坐标；normalized：保留 r02 已接受 placement，scale=1。不要照抄旧 R06C .52/高度归一再叠一次。新 normalScale 固定 1.2708995647382297，恢复六瓣后实际静态身体高度约 2.248，不能为凑 2.35 再把帽子放大。
- 本体内部原 yaw=.88 保留；宿主不要再加一遍。`faceCamera` 使用真实相机世界坐标；完成转场投影/飞行变换后再 `finalizeEyes()`。
- 正面双眼平衡；侧向画面左近眼略大、右远眼略小；正面/侧面闭眼独立曲线沿 progress 连续形变。几何与材质冻结。
- `setColourContext('stage'|'curtain'|'normal')` 或 `setContextMix(0..1)` 只调场景响应增益和环境强度；接受模型 albedo 不变。深舞台到正常游戏连续过渡由宿主开始背景切岛时调用。新交接 payload 带 acceptedId 和 contextMix；旧 payload albedo 不会覆盖接受 A 材质。
- `reset()` 清动作/粒子；`dispose()` 先释放效果再模型。不要 dispose 后复用。`snapshot()` 可查 acceptedId、context、影子规则、当前姿态。

## 历史小号粒子已恢复

原始来源：r07d `horn-dissolve-r05.mjs` 与 math；具体原文件 SHA 见 evidence/PARTICLE_SOURCE.json。真实 26 小号网格 / 72480 三角，表面面积加权采样，768 实例粒子；小号以 shader discard 逐片消失，材质 opacity 恒 1。仅小号 castShadow=false，身体/帽子/其它影子保留。

`rig.createRetirement(sceneRoot,{matrixAt,count:768})`；sceneRoot 必须是场景世界根。matrixAt(t) 仅提交出生时姿态/宿主变换，再返回 `rig.native.horn.matrixWorld.clone()`；不要递归更新 retirement。构造会采样姿态，完成后恢复所需时间。运动路径/基础锚点换了须销毁并重建出生缓存。

音乐尾 14.809；逐片消散 14.859–16.359；小号隐藏 16.459；实际粒子最后寿命约 17.1264。不是旧 13.9 音轨锚。`samplePose` 有效果时自动更新，或自定义舞台每帧手动 effect.update(t)，不要两者混用。非吹奏姿态 reset 粒子。

## 验证与覆盖边界

CPU：9 姿态 + 54 原动作共 413 调用；35 冻结文件 hash；真实粒子/主体 discard progress 同步；尾→零→再播实例矩阵和 alpha 字节一致；仅小号去投影；旧句柄幂等销毁/实例dispose事件。独立只读复核通过。详见 evidence/COMPONENT_CPU_CHECK.json。

**浏览器、GPU shader、实际像素、file 冷开未验。既有 file 访问被自动审批拒绝，未换协议/工具绕过。**

覆盖清单：本共享组件正式模型可交原岛 writer 接入；新 viewer/动作库/舞台为后续同模型集成候选。旧 r02 HTML、R06C 比较、历史备份不批量改；岛由原 writer 负责；整站暂停。不能把组件锁定当作全部场景真实动态验收完成。
