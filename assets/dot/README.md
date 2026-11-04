# Dot 正式 D r02｜共享组件与场景接入 r01

用户正式采用的模型：D 融合 r02（六瓣轮廓、正侧眼睛、A 材质/帽子/24小号形变、C响应）。35个model源文件已逐字节冻结；原r02、旧canonical与旧舞台保留。共享模型 acceptedId=Dot/D02/ACCEPTED/20261031。

主入口：Dot_D02_正式模型_动作库_粒子退场_r01.html。真正内嵌实时3D模型；9类接受姿态+54原动作，共59个去重选项。可播放、暂停、重播、拖进度、切灯光/机位、强制睁闭眼。已找回r07d真实小号表面粒子退场，不是视频或整号opacity渐隐。

共享代码：index.mjs。精确API/坐标/相机/旧动作库迁移见 handoff/README_ISLAND_WRITER.md；源码ZIP含 model/runtime/effects/preview/tools/licenses。构建：python -X utf8 tools/build-viewer.py。CPU核验：node tools/verify-component.mjs（参数为本解包根目录）。没有内部RAF、服务或全局GSAP ticker改写。

模型：正式采用。组件与新预览：CPU验证通过，浏览器、file冷开、真实shader编译、实际画面及性能未验。此前自动审批拒绝file页面访问；本轮未重试、未换协议/服务器/浏览器/代理绕过。

当前有效使用点覆盖：
- 共享组件：本包正式冻结，供所有原writer接入。
- 独立模型预览/动作库：本单HTML已接同一组件；不是旧R06C查看器。
- 舞台：另存 DotStage_D02_ACCEPTED_integration_r01_20261031，已接该组件及恢复粒子，仅CPU候选。
- 小岛：由原writer接入；本线程没有跨写其目录。舞台当前仍嵌旧v06.2/R06C临时接口，只供旧桥接保留，不是D02全链完成。
- 旧SELECT/A-B-C/D-r01/r02/R06C查看器及历史包：保留，不批量改历史。
- 整站：暂停，未恢复开发或发布。

CPU证据：9姿态与54原动作413调用；35原文件hash；真实号体26网格/72480三角/768粒子；主体discard进度核对；尾→0→重播矩阵及alpha字节一致；仅小号无投影；旧句柄幂等销毁及实例dispose事件。独立只读审计复核通过。未把这些称为浏览器动态通过。

外观材质不被旧handoff albedo覆盖；旧接口不是完整drop-in，缺dot.setFrame/getFrame的旧调用须迁移，不照抄旧R06C缩放。相机和桥接全部变换完成后才能finalizeEyes。场景正常蓝与深舞台受光连续；具体实际像素仍待合法入口验收。
