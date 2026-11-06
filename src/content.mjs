// Author copy and locally sourced process media, revised from the author annotations on 2026-11-06.
export const CHAPTERS = [
  {
    "title": "看清想法",
    "kicker": "01 / 从音乐出发",
    "description": "把脑海里的感觉，变成可以一起观察的画面。",
    "color": "#245bdb",
    "cards": [
      {
        "id": "idea-style",
        "title": "这条视频是从音乐出发的",
        "subtitle": "看清想法",
        "image": "./assets/editorial/mood-catch.webp",
        "body": [
          "我最先做的，是在 PR 里把音乐剪到大概 45 秒。然后反复听，想这段音乐适合配什么画面。",
          "它给我的感觉很适合做产品的英雄亮相。所以我先顺着这个感觉去找参考图和视频，把喜欢的构图、灯光、材质，还有运动方式放在一起，做成情绪板。",
          "找参考的时候，我会分别看它们哪里有用。有的图是光影好，有的视频是节奏好，还有的只是某一个转场值得借鉴。把这些放在一起，慢慢就能看清楚，我到底想做一个什么样的片子。",
          "这些参考也要给 AI 看。只说“要高级一点”“要有科技感”，它和我脑子里想的东西可能差得很远。有了图，至少我们可以指着同一个画面讨论：我想要的是这个轮廓、这个明暗关系，还是这个运动的感觉。",
          "[图片占位：音乐对应的情绪板]"
        ],
        "number": 1,
        "chapterTitle": "看清想法",
        "label": "01.01 / 看清想法",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/mood-catch.webp",
            "after": 0,
            "caption": "《Catch Me If You Can》片头 · 爵士乐与图形节奏参考",
            "width": 1080,
            "height": 608
          },
          {
            "kind": "image",
            "src": "./assets/editorial/mood-rog.webp",
            "after": 2,
            "caption": "ROG 实验室 · 空间、背光与产品亮相参考",
            "width": 900,
            "height": 502
          },
          {
            "kind": "image",
            "src": "./assets/editorial/mood-monsters.webp",
            "after": 4,
            "caption": "《Monsters, Inc.》片头 · 形状组装与运动节奏参考",
            "width": 1080,
            "height": 584
          }
        ]
      },
      {
        "id": "idea-type",
        "title": "想清楚这条视频里要放什么",
        "subtitle": "看清想法",
        "image": "./assets/editorial/style-products.webp",
        "body": [
          "接下来才是考虑，四个产品分别怎么出现。",
          "SU7、G1、Vision Pro 和 Rubin，需要分别考虑适合怎样的展示方式。比如 SU7 可以展示车身、轮廓和运动；G1 可以通过动作表现机器人的状态；Rubin 可以从一颗芯片，逐步看到板卡、机架和集群。Dot 则是另外一个角色，可以有自己的表情和性格，也可以在不同段落之间穿梭。",
          "我想试它们不同的形态、画风、动作和场景，所以也把片子划成了几个不同风格的段落。有的更接近产品宣传片，有的偏图形化，有的适合用字符、描边或者交互效果来做。不同段落也可以用不同的技术实现。",
          "不过，这里也是我后来反思比较多的地方。我一开始想塞太多东西，风格想试，工具也想试，觉得应该都能很快做出来。结果任务越铺越开，中间还一直改主意，最后每件事都容易做不到位。",
          "所以我现在会先看，这个画面在片子里有没有必要，它能不能接上前后。如果只是因为某个效果看起来很好玩，就想把它塞进去，我会先记下来，不一定放进这一条。"
        ],
        "number": 2,
        "chapterTitle": "看清想法",
        "label": "01.02 / 看清想法",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/style-products.webp",
            "after": 0,
            "caption": "产品与动词 · SEE / MOVE / DRIVE 的画面方向",
            "width": 511,
            "height": 1000
          },
          {
            "kind": "image",
            "src": "./assets/editorial/style-drive.webp",
            "after": 2,
            "caption": "SU7 · DRIVE 印刷质感视觉锚点",
            "width": 1200,
            "height": 675
          },
          {
            "kind": "image",
            "src": "./assets/editorial/style-move.webp",
            "after": 3,
            "caption": "G1 · 让动作进入图形化构图",
            "width": 1672,
            "height": 941
          }
        ]
      },
      {
        "id": "idea-dot",
        "title": "把想法细化成每个镜头",
        "subtitle": "看清想法",
        "image": "./assets/editorial/pr-timeline.webp",
        "body": [
          "有了大致方向，我就回到 PR 里做分镜。",
          "我的做法很简单：在视频轨道上放文字图层，一边听音乐，一边按节奏把文字图层切成很多小段。然后再一点点听，在每一段里打字，写这里准备放什么画面。",
          "比如这里是产品出现，那里是一个动作，再往后需要切到什么景别。因为文字本身就在时间线上，我可以直接播放，听它是不是卡在合适的位置，看看这段时间够不够完成这个动作。",
          "这样先得到一版带音乐、带时间关系的动态分镜，再把它给 AI。它能知道每个画面准备放在哪里，持续多久，前后接的是什么。我自己也不用只靠脑子记着这四十多秒。",
          "然后再补图片分镜，把关键画面的构图、产品位置、明暗关系和大致风格确定下来。动态分镜帮我看节奏，图片分镜帮我看画面。做到这一步再开始制作，后面讨论起来会具体很多。",
          "[图片或视频占位：PR 文字动态分镜与图片分镜]"
        ],
        "number": 3,
        "chapterTitle": "看清想法",
        "label": "01.03 / 看清想法",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/pr-timeline.webp",
            "after": 0,
            "caption": "PR 真实时间线 · 先切出文字图层与音乐段落",
            "width": 1800,
            "height": 1227
          },
          {
            "kind": "image",
            "src": "./assets/editorial/storyboard.webp",
            "after": 6,
            "caption": "图片分镜 · 前 12 秒早期概念草稿（含 Spark 旧方向）",
            "width": 1800,
            "height": 518
          }
        ]
      }
    ]
  },
  {
    "title": "组织步骤",
    "kicker": "02 / 把想法排进时间",
    "description": "先让过程有顺序，再把每一步做扎实。",
    "color": "#cf613e",
    "cards": [
      {
        "id": "steps-timeline",
        "title": "搞清楚每一步要得到什么",
        "subtitle": "组织步骤",
        "image": "./assets/editorial/rubin-board.webp",
        "body": [
          "开始做之前，我会先把眼前这一步的目标说清楚。现在是在找参考，还是需要生成一张参考图？有没有能直接用的模型、动作库或工具？这一轮要看的是造型、动作，还是最终的材质效果？",
          "如果这些混在一起，我很容易一边让 AI 做模型，一边又改画风、改镜头。做到最后，看起来什么都在动，但很难判断到底哪一步出了问题。",
          "Rubin 就是一个比较具体的例子。现成模型没有找到合适的，我就让 AI 先找真实产品的资料和图片，从芯片的 die、封装，到板卡、托盘、机架和集群，把这些层次的关系理清楚，再让 Codex 去建模。",
          "这中间也出现过凭想象补结构的问题。有些东西乍一看像芯片，仔细对照参考，就会发现形状或者连接方式不对。所以我会回到参考图上看，先把当前这一层做对，再往下接。后来板子和卡的图看起来基本达到我的要求，才继续考虑从芯片到板卡、机架、集群的连贯动效。",
          "这段对我比较有用的经验是：搜不到合适的模型，也可以自己做。但自己做之前，还是得先把要做的东西看清楚。尤其是有真实原型的产品，不能因为 AI 很快给出了一个三维模型，就默认它长得对。",
          "[图片占位：Rubin 参考与建模过程]",
          "Dot 的动作库是另一种做法。我当时同时用 Gemini 和 GPT 试了一组角色动画，先不纠结 Dot 最后长什么样，直接用一个三维圆球代替它。",
          "我把它描述成一个悬浮在空中的小精灵，像游戏里经常陪着玩家、给玩家提示的角色，希望动作活泼一点、可爱一点。然后让 AI 找找有没有现成的库，或者自己做一组常用动作，尽量覆盖游戏里可能遇到的情况。",
          "这组动作做成了可以预览的 HTML，之后可以再替换角色模型。这样我先看的就是动作本身：它怎么靠近，怎么停下来，怎么表现一个提示。我不用等角色的造型、材质全部完成，才知道它动起来有没有感觉。",
          "这个尝试我觉得还不错，也值得留下来。后面别的角色如果有类似需求，就可以从这里继续改。当然，遇到具体镜头还是要另外调整，像后来舞台上的吹号动作，就没有靠这套动作库直接解决。",
          "[视频占位：Dot 球体动作库预览]"
        ],
        "number": 1,
        "chapterTitle": "组织步骤",
        "label": "02.01 / 组织步骤",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/rubin-board.webp",
            "after": 0,
            "caption": "Rubin 板卡 · 官方参考与 v2 / v3 建模候选对照",
            "width": 1800,
            "height": 1140
          },
          {
            "kind": "image",
            "src": "./assets/editorial/rubin-die.webp",
            "after": 6,
            "caption": "Rubin 封装 · 官方参考与 V3 / V4 候选对照",
            "width": 1280,
            "height": 312
          },
          {
            "kind": "image",
            "src": "./assets/editorial/dot-design-process.webp",
            "after": 8,
            "caption": "Dot 角色设计过程 · 六瓣轮廓与眼睛贴合的正面、侧面对照",
            "width": 1280,
            "height": 720
          }
        ]
      },
      {
        "id": "steps-depth",
        "title": "先验证能不能做",
        "subtitle": "组织步骤",
        "image": "./assets/editorial/g1-collision.webp",
        "body": [
          "G1 的部分，我先做的是骨骼绑定和动作测试。",
          "模型从官方的 URDF、STL 资料转到 Blender，再去绑定骨骼，尝试接上现成的动作。先拿正踢、拳击、回旋踢这些动作来测，看看它到底能不能动，动起来像不像那么回事。",
          "这个阶段我只需要低清的白模预览。动作都还没确定，先花很多时间把灯光、材质渲染得很漂亮，后面还是可能全部重来。",
          "测试也确实暴露了一些问题。正踢的感觉还可以，但另外一些动作的手很僵，后来又发现有一段左手穿到了头里。我就针对这些位置去改手臂和握拳的状态，再看同一个时间点有没有好一些。修过以后，那一版我觉得可以用了。",
          "这个“可以用”，也是针对当时要用的镜头来说。换一个动作、换一个机位，还得重新看。先做测试的好处，就是把这些问题提前暴露出来，不用做到最后才发现整个动作不成立。",
          "[视频占位：G1 骨骼与武打动作测试]"
        ],
        "number": 2,
        "chapterTitle": "组织步骤",
        "label": "02.02 / 组织步骤",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/g1-collision.webp",
            "after": 0,
            "caption": "G1 · 左手穿头 V2 / V3 同时间点修复对照",
            "width": 1280,
            "height": 584
          },
          {
            "kind": "video",
            "src": "./assets/editorial/g1-boxing.mp4",
            "poster": "./assets/editorial/g1-boxing-poster.webp",
            "after": 3,
            "caption": "G1 · 低清白模拳击动作测试",
            "width": 768,
            "height": 576
          },
          {
            "kind": "video",
            "src": "./assets/editorial/g1-kick.mp4",
            "poster": "./assets/editorial/g1-kick-poster.webp",
            "after": 6,
            "caption": "G1 · 右侧踢动作筛选预览",
            "width": 720,
            "height": 406
          }
        ]
      },
      {
        "id": "steps-repair",
        "title": "测试 SU7 和 G1 的风格化渲染",
        "subtitle": "组织步骤",
        "image": "./assets/editorial/su7-halftone.webp",
        "body": [
          "动作能做以后，还要看模型换一种画风能不能成立。我拿 SU7 和 G1 做了风格化渲染测试。",
          "SU7 有一轮保留了比较多的车身颜色、内部结构线和写实高光，结果细节都挤在一起，主体反而不清楚。后来慢慢收成黑色剪影、比较粗的外轮廓、少量结构线，玻璃也压暗，再用半调和硬一些的扫光去带出形体。到这一步，我才觉得大概的感觉对了。",
          "G1 也有类似的问题。有一版颜色我已经认可了，但材质看起来还是像塑料。那就得继续看表面质感，而不是一口气把颜色、灯光、机位全部换掉。固定住其他条件，再比较不同的金属质感，才更容易知道哪种处理有用。",
          "所以这一步我想确认的是：这个模型适不适合这套画风，产品还认不认得出来，放进整条片子里搭不搭。测试图好看，不代表放到镜头里就一定合适，还是要带回视频里看。",
          "[图片占位：SU7 与 G1 风格化渲染对比]"
        ],
        "number": 3,
        "chapterTitle": "组织步骤",
        "label": "02.03 / 组织步骤",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/su7-halftone.webp",
            "after": 0,
            "caption": "SU7 · 黑剪影与法线半调光影对照",
            "width": 1800,
            "height": 544
          },
          {
            "kind": "image",
            "src": "./assets/editorial/g1-material.webp",
            "after": 3,
            "caption": "G1 · 同机位工业金属材质小样",
            "width": 1000,
            "height": 1000
          },
          {
            "kind": "image",
            "src": "./assets/editorial/style-move.webp",
            "after": 5,
            "caption": "G1 · 图形化着色与动作合成",
            "width": 1672,
            "height": 941
          }
        ]
      }
    ]
  },
  {
    "title": "选择工具",
    "kicker": "03 / 让工具服务于目的",
    "description": "先想清楚要得到什么，再选择合适的做法。",
    "color": "#7660c9",
    "cards": [
      {
        "id": "tools-browser",
        "title": "按这一段画面需要什么来选",
        "subtitle": "选择工具",
        "image": "./assets/editorial/dot-render-compare.webp",
        "body": [
          "这次不同的部分，我没有都用同一个软件完成。",
          "需要更认真地处理光影、材质，或者希望镜头和模型保持稳定可控的地方，我会考虑 Blender，用它做离线渲染。需要快速看效果、调参数，或者希望画面能够交互的地方，就可以用 Three.js、HTML 这些方式。",
          "如果想继续往生成式视频的方向走，也可以把基础画面交给 Seedance，再配合滤镜工具尝试不同的视觉效果。",
          "比如 SU7，我后来就调整过交付方式：让 Blender 把基础动画做好，只出基础渲染，交给 Seedance 当动效参考，再尝试生成成片。G1 则可以先交带动画的 GLB，我自己导进去做着色。",
          "有时候想要一个比较写实的光影和材质效果，也没必要一开始就硬上 Blender，把每个材质都调到底。可以先在 Blender 里把模型、机位和运动关系做好，用白模试一轮生成，看看结果值不值得继续。",
          "不过这条路也要看具体要求。Seedance 生成出来的画面，可能会改变机位、动作，甚至产品的结构。如果这个镜头要求这些东西必须准确保留，我就不能只因为某一帧漂亮，就把它当成已经解决了。还是得看完整段落，再决定继续生成，还是回到更可控的做法。"
        ],
        "number": 1,
        "chapterTitle": "选择工具",
        "label": "03.01 / 选择工具",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/dot-render-compare.webp",
            "after": 0,
            "caption": "Dot · 参考目标与 Blender 候选画面对照",
            "width": 1280,
            "height": 924
          },
          {
            "kind": "video",
            "src": "./assets/editorial/su7-seedance.mp4",
            "poster": "./assets/editorial/su7-seedance-poster.webp",
            "after": 4,
            "caption": "SU7 · 用户保留的 Seedance 车载视角生成片段",
            "width": 960,
            "height": 540
          },
          {
            "kind": "image",
            "src": "./assets/editorial/style-move.webp",
            "after": 6,
            "caption": "G1 · 原模型上的图形化着色结果",
            "width": 1672,
            "height": 941
          }
        ]
      },
      {
        "id": "tools-material",
        "title": "没有锤子就自己造",
        "subtitle": "选择工具",
        "image": "./assets/editorial/ascii-lab.webp",
        "body": [
          "还有一些时候，现成工具不太顺手，或者只差一个小功能。这种时候，我现在会直接试着让 AI 做一个。",
          "ASCII 加 tracker 就是这样来的。我想要主体变成字符效果，同时有一些跟踪框，像开了几个小窗口，露出同一位置原本的彩色模型。这个需求说起来不复杂，但要找到完全合适的现成效果，也不一定那么容易。",
          "那就把想要的效果说清楚，让 AI 做成一个可以预览和调整的工具。做到 ASCII Track Lab 那一版时，我觉得方向非常对，就让它留着备用。",
          "这里有个很实际的变化：以前缺一个工具，我可能会先想，是不是得学一个新软件，或者换一种办法绕过去。现在我会多想一步，这个小工具能不能直接做出来？",
          "所以我给这一段起的名字就是“没有锤子就自己造”。当然，工具做出来以后还得试，预览和导出也要分别检查。但哪怕它先只解决眼前这个问题，也已经值得留下来，下次可以接着用。",
          "[视频占位：ASCII 与 tracker 工具效果]"
        ],
        "number": 2,
        "chapterTitle": "选择工具",
        "label": "03.02 / 选择工具",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/ascii-lab.webp",
            "after": 0,
            "caption": "ASCII Track Lab · 字符、彩色跟踪窗与参数界面",
            "width": 1180,
            "height": 760
          },
          {
            "kind": "video",
            "src": "./assets/editorial/ascii-user-00.mp4",
            "poster": "./assets/editorial/ascii-user-00-poster.webp",
            "after": 3,
            "caption": "ASCII + Tracker · 作者提供的 SU7 彩色窗口演示",
            "width": 1920,
            "height": 1080
          },
          {
            "kind": "video",
            "src": "./assets/editorial/ascii-lab-demo.mp4",
            "poster": "./assets/editorial/ascii-lab-demo-poster.webp",
            "after": 6,
            "caption": "ASCII Track Lab · 真实工具界面录屏",
            "width": 1180,
            "height": 760
          }
        ]
      },
      {
        "id": "tools-reference",
        "title": "让 AI 帮我找到没想到的工具",
        "subtitle": "选择工具",
        "image": "./assets/editorial/react-gradient-poster.webp",
        "body": [
          "自己造工具之前，也可以先让 AI 帮忙找一圈。",
          "比如碰到建模问题，可以问问有没有适合的 CAD 工具或者现成库；做网页和视觉效果，可以看看 React Bits 这样的组件库，有没有已经做好、可以借鉴的实现。",
          "这次我就发现，有些东西其实早就有人做过，甚至已经开源了，只是我自己不知道，或者知道了但没想起来用。React Bits 里的一些效果，我已经收藏过，真正做东西的时候却还是可能从头描述一遍，让 AI 再造一次。",
          "所以除了说“帮我实现这个效果”，我也会多问一句：“有没有现成的工具或者库？先找找看。”找到之后，再判断能不能用、要改多少。AI 能帮我写，也可以帮我把那些已经存在、但我没注意到的东西翻出来。"
        ],
        "number": 3,
        "chapterTitle": "选择工具",
        "label": "03.03 / 选择工具",
        "media": [
          {
            "kind": "video",
            "src": "./assets/editorial/react-gradient.mp4",
            "poster": "./assets/editorial/react-gradient-poster.webp",
            "after": 0,
            "caption": "React Bits / Gradient ASCII · 已留存的官方效果参考",
            "width": 800,
            "height": 500
          },
          {
            "kind": "video",
            "src": "./assets/editorial/react-terminal.mp4",
            "poster": "./assets/editorial/react-terminal-poster.webp",
            "after": 3,
            "caption": "React Bits / Faulty Terminal · 已留存的官方效果参考",
            "width": 800,
            "height": 500
          }
        ]
      }
    ]
  },
  {
    "title": "发现问题",
    "kicker": "04 / 把目光放到具体处",
    "description": "先看见差别，才能把反馈变成有效的修改。",
    "color": "#b89335",
    "cards": [
      {
        "id": "review-motion",
        "title": "给 AI 发挥余地，也让它先自检",
        "subtitle": "发现问题",
        "image": "./assets/editorial/g1-collision.webp",
        "body": [
          "这次做下来，我发现自己一开始把有些东西定得太死了。技术路线、具体做法，能想到的要求都先写上去，生怕它理解错。结果也把它框住了。",
          "后来我就想换一种试法：先把需求和参考图给清楚，让它自己想怎么做。先看一个结果，再一点点改。",
          "我之前用分数打过一个比方：完全交给 AI 发挥，它可能给我一个 80 分的东西，但方向完全不对，那这 80 分也没用；如果一开始限制太多，方向虽然对，却可能只做出 60 分，而且后面再想提高也很难。",
          "我现在会尽量分清楚，哪些地方我真的有要求，哪些只是我暂时想到的一种做法。画面里必须有什么、什么不能改，要说清楚；具体怎么实现，可以给它留一些空间。需要严格照参考做的时候，也直接告诉它，哪些地方不能自由发挥。",
          "另外，我不想每一步都由我来找基础问题。模型没显示、动作穿模、网页打不开，这些如果全要我先发现，再截图发回去，其实并没有省多少时间。",
          "所以我会把制作和检查拆开，让子 agent 或者另一个 AI 先看实际渲染出来的图片、视频帧和动态结果，对照参考找问题。不要只看它说代码写完了，要看做出来的东西。最好能指出具体在哪个时间点，哪里不对，可以怎么改，再交回去修改。",
          "这样能替我做一部分初步检查。但最后这个画面喜不喜欢，节奏对不对，能不能放进片子，还是需要我自己看。AI 的检查也可能漏掉问题，不能因为它自己说通过了，就直接收下。"
        ],
        "number": 1,
        "chapterTitle": "发现问题",
        "label": "04.01 / 发现问题",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/g1-collision.webp",
            "after": 0,
            "caption": "G1 · 对照同一时间点查找动作穿插",
            "width": 1280,
            "height": 584
          },
          {
            "kind": "image",
            "src": "./assets/editorial/frame-failed.webp",
            "after": 6,
            "caption": "第 118 帧 · 前景 B 层突然消失的失败状态",
            "width": 640,
            "height": 360
          }
        ]
      },
      {
        "id": "review-detail",
        "title": "做一个会思考的甲方",
        "subtitle": "发现问题",
        "image": "./assets/editorial/feedback-dot.webp",
        "body": [
          "给 AI 留空间以后，我自己也要把反馈给好。我觉得这里可以叫“做一个会思考的甲方”。",
          "首先是标注清楚。发现一个地方不对，我会尽量圈出具体位置，或者画一张很简单的草图，让它知道我指的是哪一块。特别是模型结构、物体之间的位置关系，用图说明通常更直接。",
          "然后是表达清楚。不要只说“不好看”“再高级一点”，我得想一下，到底是什么让我觉得不对。是轮廓太细，颜色太灰，细节太多，还是动作没有力度？这一轮想改什么，什么已经可以、不要再动，也要一起说。",
          "比如有一轮修改，我会明确说：只按这次发的标注改，没提到的地方先别动；蓝色从现在已有的渐变里取，但饱和度要更高，字符要有蓝白渐变。这样的反馈，它至少知道要往哪里改，也比较不容易把已经认可的部分一起改掉。",
          "还有就是不懂就问。我不熟悉的技术很多，没必要先装成自己都懂，再给它安排一套做法。它提了一个工具，我就问为什么选它；它说实现不了，我就问卡在哪里；有几个方案，我就问各自要付出什么、可能损失什么。",
          "问清楚以后，我再决定。这样给出的意见，也更可能真的帮到这张画面。"
        ],
        "number": 2,
        "chapterTitle": "发现问题",
        "label": "04.02 / 发现问题",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/feedback-dot.webp",
            "after": 0,
            "caption": "原始反馈 · 用红框与文字指出 Dot 的光影问题",
            "width": 1655,
            "height": 979
          },
          {
            "kind": "image",
            "src": "./assets/editorial/feedback-sketch.webp",
            "after": 2,
            "caption": "原始草图 · 舞台透视与角色位置关系",
            "width": 297,
            "height": 166
          },
          {
            "kind": "image",
            "src": "./assets/editorial/su7-blue.webp",
            "after": 4,
            "caption": "颜色反馈 · 官方蓝、原偏青与修正后对照",
            "width": 1800,
            "height": 542
          }
        ]
      },
      {
        "id": "review-dot",
        "title": "很难实现的时候 及时换路线",
        "subtitle": "发现问题",
        "image": "./assets/editorial/su7-wing.webp",
        "body": [
          "有些问题值得继续改，有些就要停一下，看看是不是已经花了太多时间。",
          "SU7 的尾翼就是一个例子。第一版少了支架，看起来是悬空的；后面补了支架、调整路径，再往后又尝试了拼接和收纳，但接缝还是不对。改了几轮以后，我就决定先不纠结这个尾翼了，回到原来的蓝色 SU7 模型。",
          "对这条视频来说，继续把时间压在尾翼上，已经不划算了。",
          "同样的，一个画面如果用某种方法一直做不顺，也可以换工具、换表现方式，或者缩小这一段的目标。先看它在整条片子里到底承担什么作用，再决定值不值得继续往里投时间。",
          "当然，回退能做得这么直接，也有个前提：之前能用的版本得留着。不能一边改，一边把退路全覆盖掉了。"
        ],
        "number": 3,
        "chapterTitle": "发现问题",
        "label": "04.03 / 发现问题",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/su7-wing.webp",
            "after": 0,
            "caption": "SU7 V3 · 尾翼收纳失败的过程记录",
            "width": 1067,
            "height": 1000
          },
          {
            "kind": "image",
            "src": "./assets/editorial/su7-blue.webp",
            "after": 3,
            "caption": "SU7 · 保留原蓝色与外观作为后续基线",
            "width": 1800,
            "height": 542
          }
        ]
      }
    ]
  },
  {
    "title": "完成交付",
    "kicker": "05 / 让成果可以继续使用",
    "description": "把观看、互动与继续制作，整理成清楚的入口。",
    "color": "#338b82",
    "cards": [
      {
        "id": "delivery-feedback",
        "title": "把这次分享做成一个网站",
        "subtitle": "完成交付",
        "image": "./assets/editorial/workbench.webp",
        "body": [
          "这次分享，我想用网站来承载。大家可以直接看视频，也能像游戏一样操作一些内容，亲自切换效果、试试参数，再把感兴趣的资源拿走。",
          "有些效果只放在视频里，很难讲清楚它还能怎么用。比如一个可替换角色的动作库，或者一个字符效果工具，如果能直接点开试一下，就更容易想到它还能放进自己的什么项目里。",
          "所以我也希望把这次做出来的东西，尽量往模板和工具的方向整理。某个效果这次做好了，下次就能从这一版开始改，不用再把需求从头描述一次。",
          "在制作过程中，我已经开始把对话里散落的资料、参考、分镜、版本和待办收进自己的工作台。这样我可以比较快地找到，现在用的是哪一版，当时为什么改，接下来还有什么没做完。",
          "一些反复验证过的做法，也可以再整理进经验库，或者写成 Skill。下次碰到相似任务，就把这些经验拿出来用。这里面也应该记失败的尝试，知道哪条路走不通，有时候同样能省事。",
          "分享网站、工作台和经验库，内容还需要继续整理和筛选。适合给大家用的工具和工程，再放到对应的入口里，让大家找得到，也知道怎么打开、怎么继续改。",
          "[图片占位：分享网站与工作台]"
        ],
        "number": 1,
        "chapterTitle": "完成交付",
        "label": "05.01 / 完成交付",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/workbench.webp",
            "after": 0,
            "caption": "创作工作台 · 项目概览与进度入口（本轮补拍历史快照）",
            "width": 1265,
            "height": 712
          },
          {
            "kind": "image",
            "src": "./assets/editorial/versions.webp",
            "after": 6,
            "caption": "资料档案 · 来源与版本记录（本轮补拍历史快照）",
            "width": 1265,
            "height": 712
          }
        ]
      },
      {
        "id": "delivery-package",
        "title": "把工程和成品整理好",
        "subtitle": "完成交付",
        "image": "./assets/editorial/archive.webp",
        "body": [
          "做到最后，还要让 AI 把工程文件和导出的成品整理好。",
          "制作过程中会产生很多脚本、临时文件和中间版本，我不需要每一个都亲自管理，但最后交到手里的东西，应该能让我看明白。哪个是工程，哪个是预览，哪个是正式导出，用了什么素材，有没有需要一起保留的依赖，最好都整理清楚。",
          "之前有一次把几个模块的工程、预览、参考和说明集中打包，审核起来就舒服很多。我不用再回到聊天记录里翻几十条消息，找那个不知道发在哪里的文件。",
          "能用的版本也要做好备份。改之前留一份，重要节点再留一份，把版本之间改了什么写清楚，方便改回第一版（不是）。"
        ],
        "number": 2,
        "chapterTitle": "完成交付",
        "label": "05.02 / 完成交付",
        "media": [
          {
            "kind": "image",
            "src": "./assets/editorial/archive.webp",
            "after": 0,
            "caption": "工程归档 · 按模块记录工程包、预览与校验信息",
            "width": 1265,
            "height": 712
          },
          {
            "kind": "image",
            "src": "./assets/editorial/batch-delivery.webp",
            "after": 3,
            "caption": "批量交付记录 · 一批成果，一个审核入口",
            "width": 1265,
            "height": 712
          }
        ]
      }
    ]
  }
];

export const RESOURCES = [
  {
    id: 'prompts',
    status: '待补充',
    title: '想法笔记',
    description: '把需求、参考和验收点整理成可复用的提示词。',
    body: [
      '这里将收录本次创作中可以复用的提问方式与提示词示例，让目标、参考、限制和期待的交付更清楚。',
      '正式内容与领取文件尚未放入。准备完成后，这本笔记会保留清楚的预览、用途说明和版本信息。'
    ],
    kind: 'book'
  },
  {
    id: 'skills',
    status: '待补充',
    title: '制作工具箱',
    description: '把常用的步骤、检查方法与 Skill 放在一起。',
    body: [
      '这里将整理可重复使用的制作方法：从拆解任务到检查画面，再到整理成果。每个工具都会说明适用场景与使用方式。',
      '当前是资源位置预留，尚未接入正式 Skill 文件或安装入口。'
    ],
    kind: 'toolbox'
  },
  {
    id: 'projects',
    status: '待补充',
    title: '继续创作',
    description: '从可编辑的项目出发，把这次经验接着做下去。',
    body: [
      '这里将放入允许领取的示例工程，并说明如何打开、如何替换内容，以及需要哪些运行条件。',
      '工程包与领取入口尚待整理确认。当前制作使用的私密源文件不会自动成为资源架中的下载内容。'
    ],
    kind: 'project'
  }
];
