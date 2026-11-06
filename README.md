# 灵感先行 r30 · 可移交部署包

用户提供的 Console 已确认：`/src/main.mjs`、`IdeaSans-Bold.woff` 和 `IdeaSans-Regular.woff` 返回 404；data URL SVG favicon 被目标站点的 CSP 拦截。入口与字体缺失是已观察到的启动故障，为什么上传后丢失这些文件尚未确认。本版做相应兼容加固；目标站访问目前受 WAF 403 影响，不能声称已在该热铁盒站实测修好。

## 两份包

- `Linggan_r30_Static_Deploy.zip`：已构建静态产物。根目录直接有 `index.html`，必须将整套解压内容上传并覆盖网站根目录，保留完整 `src/`、`assets/` 与样式文件；不能只上传 HTML，不能再包一层 `dist`，也不能把源码包当作发布文件。无需 Node、数据库或运行依赖。
- `Linggan_r30_Editable_Handoff.zip`：可编辑原生 ESM 源码、运行所需资产、构建脚本与测试。Node.js 22 或更新版运行 `npm run build`，产物在 `dist`；`npm start` 预览构建产物，`npm run dev` 用于源码开发。原始 `.mjs` 源码和原资源路径可保留供编辑，部署时以新构建的 `dist` 为准。

## r30 部署兼容处理

构建产物把 `.mjs` 模块转换为 `.js`，并同步改写模块依赖；中文资源目录转为 ASCII portable 资源名，保留对应资源字节与路径映射。首页 JS 入口携带 release hash，减少更新后缓存混用的机会；favicon 改为普通 `assets/favicon.svg` 文件，避免使用被目标 CSP 拦截的 data URL。不要把旧版的 HTML、JS 或资源目录与本版文件混合上传。

启动错误提示独立于三维主程序：模块加载或启动失败时给出可见错误；超过 60 秒仍在准备时显示慢加载提示。慢加载提示并不等于已诊断网络、浏览器或托管平台的具体故障。

正片使用每块最多 4 MiB 的 `.bin` 文件，文件名包含原片 SHA 前缀。浏览器按原顺序拼成同一份 MP4 Blob，不重编码、不删帧。请完整保留全部块及 manifest，不要单独播放 `.bin`，也不要删掉看似重复的块。

## 热铁盒

静态包的所有文件都小于 5 MiB，文件数少于 1000。可上传解压后的文件和目录；是否支持网页端自动解压 ZIP 以当前平台界面为准。源码包的 `rth-host.json` 使用 `build="build"`、`outdir="dist"`；目标站点与 `RTH_API_KEY` 由部署者在自己的平台环境中配置，包内没有站点身份或密钥。建议部署至本网站专用站点。

## 飞书妙搭

可将源码包交给妙搭的“导入新应用”或接收方开发者。保持现有 Three.js 和原生 ESM 实现，构建命令 `npm run build`，输出目录 `dist`。妙搭工作流可能需要将图片、音视频、模型、字体上传到该应用的文件存储并映射资源 URL，须确保动态 import、fetch、字体与解码器路径一并对应。未在目标妙搭应用内完成导入发布时，不将本地打包说成平台上线成功。

## 服务与缓存

`.js` 返回 `text/javascript`，JSON 为 `application/json`，WASM 为 `application/wasm`，MP4 为 `video/mp4`，M4A 为 `audio/mp4`，GLB 为 `model/gltf-binary`，BIN 为 `application/octet-stream`。缺失的模块或媒体必须返回 404，不能重写成 `index.html`。直接点播的 MP4 需要 HTTP Range；正片的完整二进制块只需普通 GET。

`index.html`、启动脚本及未带内容 hash 的清单/代码应允许缓存重新验证；带内容 hash 的 BIN 块可长期 immutable 缓存。更新时发布整套新构建产物，必要时清理目标平台 CDN 的旧首页缓存。用 HTTP/HTTPS 测试，不能以双击 `file://` 作为验收。

发布后检查：首页准备与错误提示、影片播放、舞台衔接、长卷滚动、卡片开关与视频、游戏进出、声音和窄屏阅读。浏览性能依赖设备 GPU、浏览器和网络，不能保证所有设备始终零掉帧。

官方资料：
- 热铁盒官方 CLI：https://host.retiehe.com/cli
- 飞书妙搭 ZIP 导入说明：https://www.feishu.cn/content/article/7597741503372512473

包外 `r30_部署包校验清单.json` 记录 ZIP SHA256、逐文件 SHA256、大小及引用闭合检查结果。
