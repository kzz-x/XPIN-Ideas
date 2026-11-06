灵感先行 r31 · 部署说明

用户已确认此前直接上传了 ZIP。r30 入口已加载，但字体、WAV、M4A、SVG 等多项资源在线返回 404；音效请求被转到热铁盒 CDN。不能据此判断是用户漏传，也没有证据证明这些扩展不受平台支持。官方 CLI 将这些格式作为原始二进制字节上传；网页 ZIP 导入与二进制权限、后端发布/CDN 的实际状态仍需验证。本版提供逐文件校验及官方 CLI 上传入口，不能把尚未执行的目标站发布说成已修复。

## 先用一键部署

解压 `Linggan_r31_Static_Deploy.zip` 到普通本地文件夹，双击 `DEPLOY_TO_RETIEHE.cmd`。脚本先校验全部运行文件的大小和 SHA256，显示固定目标 `https://xpinkkz.rth1.xyz/`，由你按 Enter 开始。它只上传已构建的静态文件，不执行构建、不上传源码或说明文件。需 Node.js 22 或更新 LTS。

前往热铁盒右上角菜单“API 密钥”取得你自己的密钥。脚本优先读取当前本机进程的 `RTH_API_KEY`；未设置时在本机窗口隐藏输入。不要把密钥发进聊天。脚本不创建 `.env`，不把密钥写入参数、文件或日志，只给官方 CLI 子进程的环境变量；显示输出也会将同一密钥替换为 `[REDACTED]`。

脚本从官方 `https://host.retiehe.com/cli` 下载当前已核验的 CLI 6.2.2，并检查固定 SHA256；官方 CLI 如更新导致 hash 不符，会在上传前停止。使用命令 `node <official-cli.cjs> deploy --site xpinkkz --outdir dist`。在隔离临时目录运行，没有源码包里的 build 配置，所以只上传这份发布文件。官方 CLI 会更新该站并删除远端不在本发布目录中的旧文件；目标就是当前网站 `xpinkkz`。

上传成功后脚本再从公开网址下载全部运行文件，检查字节和 SHA256。输出会区分 `MISSING`（HTTP 404）、`DENIED`（HTTP 403）、网络错误与 `DIFFERENT_BYTES`（已返回响应，但字节或 SHA 不一致）。字节不同可能是旧缓存或平台的合法正文/图像变换，不能直接当成缺文件，也不会虚报为精确字节校验成功。网络较慢时逐文件检查需要时间。脚本完成不替代实际影片、卡片、音频与交互验收。

只想检查本地包时，在 PowerShell 执行 `powershell -NoProfile -File .\DEPLOY_TO_RETIEHE.ps1 -DryRun`。DryRun 不读取密钥、不下载、不发布、不改变文件。

启动器遵守本机 PowerShell 执行策略，不自动绕过或修改策略。如果执行策略阻止 `.ps1`，该脚本尚未运行，也没有开始部署；请由本机部署者按照热铁盒官方文档使用官方 CLI 手动发布，命令形式为 `node <已核验官方CLI.cjs> deploy --site xpinkkz --outdir <完整静态目录的相对路径>`，在子进程环境提供自己的 `RTH_API_KEY`，不要把密钥写入命令参数或聊天。官方文档：https://docs.retiehe.com/host/auto-deploy.html 。

## 两份包

- `Linggan_r31_Static_Deploy.zip`：可直接用上面脚本发布的完整静态成品。根目录仍含 `index.html`、`src/`、`assets-<releasehash>/` 和样式，可交给支持静态目录的部署者。运行文件以 `DEPLOY_MANIFEST.json` 为准。
- `Linggan_r31_Editable_Handoff.zip`：原生 ESM 源码、运行资产、构建脚本与测试。运行 `npm run build` 后产物在 `dist`；也可用同一个一键脚本上传 `dist`。`npm start` 预览产物，`npm run dev` 开发。原始 `.mjs` 与资源路径保留供编辑，发布以 `dist` 为准。

附带的一键脚本与 `DEPLOY_MANIFEST.json` 只对应这份未修改的 r31 发布内容。未改源码的独立重建可使用同一清单；后续编辑源码重新构建导致 hash 或资产目录变化时，需要重新生成部署清单，或按照官方 CLI 从新 `dist` 发布。旧清单会故意拒绝不匹配文件，不会自动接受任意修改后的构建。

## 兼容与资源

产物把 `.mjs` 转成 `.js` 并同步改写依赖；中文资源目录转 ASCII 路径。JS 入口携带 release hash，全部顶层资产目录也改为 `assets-<releasehash>/`，本版使用新资源地址，首次发布会重新上传整套资产，避免旧对象 MD5 记录与旧 404 缓存。资产原字节和格式保持不变，源码仍使用 `assets/`。这项版本路径处理不改变账户权限；官方 API 若拒绝上传会明确失败，不能算部署成功。favicon 为普通文件，避免旧 data URL 触发目标 CSP。独立启动提示在模块加载或初始化失败时给出错误，并在 60 秒后提示慢加载。字体或可选音效失败不应永久挡住启动，图像、模型、视频块等主体资产仍需完整上传。

正片使用每块最多 4 MiB 的 `.bin`，名称含原片 SHA。浏览器按顺序拼回同一份 MP4 Blob，不重新编码。完整保留所有块和 manifest。全部文件小于 5 MiB、文件数少于 1000。

发布后打开 `https://xpinkkz.rth1.xyz/deployment-check.html`，在同站点检查全部运行资源的 404/403 并复制检查结果。该诊断页不会在平时浏览网站时自动加载。若此页本身 404，也说明目标没有拿到完整的本版发布文件。

## 其他部署者与妙搭

完整静态目录可交给常规静态托管。妙搭可接收源码 ZIP 或由接收方导入，构建 `npm run build`、输出 `dist`；其资源托管流程可能要将图片、音视频、字体、模型映射到该应用文件存储地址。未在目标应用完成导入与验证时，不承诺零适配一键上线。

JS MIME 为 `text/javascript`，JSON 为 `application/json`，WASM 为 `application/wasm`，BIN 为 `application/octet-stream`，字体为 `font/woff`，WAV 为 `audio/wav`，M4A 为 `audio/mp4`，SVG 为 `image/svg+xml`。缺文件应返回 404，不能回退成首页。直接点播 MP4 需 HTTP Range，正片完整 BIN 块只需普通 GET。首页、代码和清单允许重新验证缓存；含内容 hash 的 BIN 可长期缓存。

检查：首页、影片、舞台、滚动、卡片视频、游戏、声音与窄屏阅读。设备 GPU、浏览器、网络各不相同，不能保证所有设备持续零掉帧。

官方依据：
- https://docs.retiehe.com/host/auto-deploy.html
- https://host.retiehe.com/cli
- https://host-intro.retiehe.com/
- https://www.feishu.cn/content/article/7597741503372512473

包外 `r31_部署包校验清单.json` 记录归档与逐文件 SHA、大小和资源引用结果。实际目标发布验证状态取决于你运行脚本后的结果。
