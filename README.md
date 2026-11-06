# 灵感先行 r29

灵感先行 r29 · 部署交接

交接对象：热铁盒静态托管，或飞书妙搭。此处“妙搭”指飞书妙搭。

一、使用哪份文件

Linggan_r29_Static_Deploy.zip：已经构建好的完整静态文件。解压后根目录直接有 index.html、src、assets、styles-combined.css。把这些文件完整上传到站点根目录，不要只上传 index.html，也不要在上层再套一层 dist。无需 npm install、无需后端或数据库。

Linggan_r29_Editable_Handoff.zip：可继续编辑的完整网页源码与运行依赖。包含原生 ESM、全部被页面引用的媒体、字体、模型和许可、测试、构建脚本与 rth-host.json。无需安装运行依赖。Node.js 22 或更新版本：
  npm run build
  npm start
构建输出目录是 dist。开发时可用 npm run dev。源码包不含旧 Sites 站点身份、账号凭据、Git 历史及无引用旧素材。

二、给热铁盒部署者

可直接托管 Static_Deploy.zip 解压后的文件；此交接不承诺网页端会自动解压ZIP，请按当前产品界面选择上传文件或目录。
如果用官方CLI从源码构建：rth-host.json 已设置 build="build"、outdir="dist"。部署者需要在目标平台配置自己的站点和 RTH_API_KEY，包内不写入域名或密钥。应使用本网站专属的空站点。
官方CLI目前会跳过大于5MiB的单个文件，且文件数限制1000。本包每个文件均小于5MiB，文件总数远低于1000。

三、给飞书妙搭部署者

在“导入新应用”中选择 Editable_Handoff.zip。保持现有Three.js/原生ESM实现，不要重写或用静态截图替代三维场景。
构建命令 npm run build，输出 dist，入口 index.html。此项目没有后端API、数据库和账号系统。若目标应用使用Node预览服务，可在该平台的受控运行环境中配置PORT以及平台要求的HOST；本机预览默认只监听127.0.0.1。
妙搭原生工作流可能要求把图片、视频、模型和字体上传该应用的文件存储，再使用返回的资产URL。这属于接收平台的导入适配：必须完整保留所有资产与相对目录，或统一映射资产URL，并验证动态import、fetch、字体和模型解码器路径。不要把二进制资产改成缺失的远程占位。
已确认飞书官方支持ZIP项目导入；未在用户的妙搭账号中实际导入或发布本包，因此不声称零适配一键部署已实测。

四、视频分块说明

assets/media/film-hd/manifest.json 列出高清片和手机版的有序二进制块。每块最多4MiB，文件名含原MP4的SHA256前缀。页面取回块后拼成同一份 video/mp4 Blob，再使用一个video解码器和连续音频时钟播放。此操作不重新编码高清影片，没有删帧或改变分辨率/音频。
不要删除.bin文件，不要把它们单独当视频播放。所有块拼接后的SHA256和原片一致。若需换正片，把新H.264/AAC MP4放回对应源码目录，运行 scripts/prepare_film.py 和 npm run split-film，再build；具体接点仍在src/config.mjs和媒体manifest维护。

五、服务配置

.mjs/.js 应返回 text/javascript；JSON为 application/json；WASM为 application/wasm；MP4为 video/mp4；M4A为 audio/mp4；GLB为 model/gltf-binary；BIN为 application/octet-stream。
不要把缺失的JS、JSON或媒体请求重写成index.html。直接点播的MP4应支持HTTP Range(206/Content-Range)。分块正片通过普通GET完整取回，不依赖Range。
index.html、content.mjs及manifest应允许重新验证缓存。带内容hash的bin块可用长期immutable缓存。托管平台可对HTML/JS/CSS/JSON启用压缩；视频/WebP/字体本身已压缩。
需要HTTP/HTTPS及WebGL2浏览器；不要通过双击index.html的file://方式验收。

六、本版内容与性能

03.02彩色窗口视频已使用作者指定的 source/00.mp4 网页副本替换，保持1920×1080、60fps与完整时长。
按作者7张标注删去正文文字预演视频、内嵌动作HTML、05.01动作工具、04.01指定局部图和05.02指定工具图；在02.01指定段落后加入Dot角色设计过程图。
正文图片和卡片视频在阅读附近才加载，预留图像比例以减少跳动；收起后暂停并释放视频解码器。稳定阅读与浏览器后台停止三维动画循环；屏外卡片/文字跳过投影和样式更新。
诊断入口仅开发使用：URL添加 ?diagnostics=1。默认正式页面不显示性能数据。请用实际设备检查正常播放、三维滚动、卡片开关、卡片视频、关卡进出和声音。
浏览流畅程度仍取决于终端GPU、浏览器、分辨率和网络；此包不会承诺所有设备始终零掉帧。

七、官方来源

热铁盒官方CLI及其当前文件校验逻辑：https://host.retiehe.com/cli
飞书官方“妙搭支持ZIP项目导入”：https://www.feishu.cn/content/article/7597741503372512473
飞书HTML/交互前端发布说明：https://www.feishu.cn/content/article/7652603741358590921

请将目标平台发布后的实际URL和验收结果交回作者。此次本机打包与浏览器检查不等同于已在热铁盒或妙搭账号内成功发布。
