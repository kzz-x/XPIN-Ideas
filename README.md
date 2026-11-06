# 灵感先行 r26

这是可独立运行和继续编辑的完整网站。运行所需素材全部随包提供，无 CDN 依赖。

## 本地预览与发布

安装 Node.js 后双击「启动预览.cmd」，或在目录运行 `node server.mjs` 并打开终端给出的地址。需要 HTTP 服务和支持 WebGL2 的浏览器，不能直接双击 index.html。

源码包：运行 `node build.mjs` 生成 dist，将 dist 内全部文件上传静态网站服务。构建会检查解压后的实际发布文件总计严格小于 40,000,000 字节；超过限制会报错。`node --test tests/*.test.mjs` 运行回归检查，无需 npm install。

发布包：直接上传包内文件，index.html 位于根目录；server.mjs 和预览启动文件仅用于本地预览。

## 本版优化

- 高清影片保持 1920×1080、60 fps 和完整剪辑时间，H.264 双遍 VBR 2.3 Mbps / veryslow，AAC 160 kbps。高清文件约 15.86 MB。
- 手机、低内存、较低解码能力、慢网/省流量设备使用同一剪辑的 1280×720、30 fps 版本，约 5.58 MB。
- 真实首页出现后立即后台下载整片并静音预解码，不等到耳机提示才开始。正片仍等待完整下载、实际解码和舞台/卷轴准备就绪；慢网期间显示真实进度。
- 正片与舞台大屏共用同一个 video 元素和音频时钟，避免第二份影片清晰度与时间错位。舞台镜头、Dot 原生模型、动作与互动保持原有版本。
- 产品 GLB 使用 Meshopt 无损缓冲压缩，顶点属性和三角面均已比对；Dot 几何不改。过程图保持尺寸转 WebP，第三方 JS 精简，移除未引用历史文件。
- BGM 使用三段整轨 AAC 160 kbps，解码后按原始采样边界排程。此版属于有损压缩，不是无损母版。
- 默认音效 100%、影片 15%、网页 BGM 6%；用户后续手动调整仍保留。浏览器禁止有声自动播放时，首次点击/按键启用声音。

## 替换新的剪辑

临时预览：制作设置 → 选择本机影片 → 设置舞台接入点 → 检查 Dot 舞台。文件只用于当前会话，不上传。

正式替换：安装 Python、ffmpeg 和 ffprobe，运行 `python scripts/prepare_film.py "D:/edits/new-cut.mp4" --stage-at 36`，将 36 改为新剪辑拉出舞台大屏的秒数。脚本生成高清/手机 MP4 和 manifest，不修改原件。然后 `node build.mjs` 重建并发布。双遍 veryslow 编码需要较长时间；新剪辑更长时可能超过 40 MB，构建会拦截，可调整 `--bitrate-k 2300`。压缩参数越小，画质越低。

也可手动替换 `assets/media/film-hd.mp4` 与 `film-mobile.mp4`，同时更新 `assets/media/film-hd/manifest.json` 的时长、帧率、尺寸、两个文件字节数和 stageAt。舞台动作长度独立于接点，若剪辑改变表演节奏需同步调整 `src/config.mjs`。

## 主要编辑入口

- `src/main.mjs`：流程与提前加载；`src/film-media.mjs`：下载、静音预热及就绪门控。
- `src/content.mjs`：章节、文案和卡片图片；`src/scroll-space.mjs`：空间卡片阅读。
- `src/config.mjs`：接点与舞台时长；`src/audio-mix.mjs`：三个默认音量。
- `src/sound-design.mjs`、`src/opening-sound.mjs`、`src/sand-sound.mjs`：互动与开场音效。
- `assets/media/bgm/stream/`：当前压缩音乐及循环/尾奏元数据。

旧视频、重复音乐与无引用素材不在交付包内。源码中的 rXX 模块名可能是被当前版本继续引用的正式实现，不能只凭名称删除。原始高码率视频与无损音频母版应另外保存；它们不属于 40 MB 网站交付包。
