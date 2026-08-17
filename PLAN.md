# DSH 液态玻璃插件计划

> 状态：模糊限定在各玻璃岛；正文内容按真实 scrollport / sticky composer 边界裁切；删除输入区白色遮罩；展开侧栏胶囊统一为 38px；设置弹窗解除侧栏层叠限制。
> 版本号以 package.json 为准，本文件不重复维护。
> 官方基线：`47f943859bef60e4160492346772ded9b24f765a`

## 运行时边界

- Runtime scheduler：`createFrameGate` 同一帧合并一次回调；`createRetryBatch` 可替换、有上限、dispose 清空。
- Metrics：节点快照所有权；替换时清旧 CSS 变量和 scroll 监听；稳定节点不 `disconnect` observer；hero 只要求 root，active 要求完整聊天节点。
- Metal：稳定草稿 0Hz；streaming ≤ 10Hz；composer 外点击只做卡片身份检查。
- 光学：默认三张贴图预生成；动态尺寸按行分片（约 4ms）且同 key single-flight；空结果不进成功缓存。
- 图片导入：`loadImageFile` / `encodeImageRegion` 必须 settle；隐藏/卸载 abort；object URL 只 revoke 一次；PNG/WebP 走无损 PNG 保持透明通道，JPEG 保持原分辨率高画质，仅预算超限才降级；裁剪会话只允许一个，commit/cancel 必须收尾。
- Host：哈希 URL immutable；legacy URL no-cache；ETag 为完整内容哈希。
- 性能门禁：`npm test` 只读检查生成物，不重写 `client.js` / fallbacks。

## 边界

- 不修改 `/Users/qin/deepseek-harness` 源码。
- 不移动 React DOM，不用 MutationObserver，不用浏览器自动化。
- `[data-conversation-scroll]` 仍是唯一会话滚动所有者。
- `[data-composer-seat]` 的 sticky / bottom / z-index 不改。
- SidebarRoot 的 width / 冻结宽度由官方控制。
- SettingsRoot 弹窗打开时，SidebarRoot 不得形成困住 `z-index:1000` 固定层的 stacking context。
- 模糊只发生在各岛 `::before`（或确认安全的叶子），不发生在壁纸、body、AppFrame、ConversationRoot 本体、scrollBody、SidebarRoot 本体。

## 模糊语义

| 设置 | 存储键 | 作用 |
| --- | --- | --- |
| 壁纸透明度 | `dsh-liquid-glass.background.opacity` | 只改 wallpaper `opacity` |
| 玻璃模糊 | `dsh-liquid-glass.glass.blur`（新，默认 20，0–40） | 写 `--lg-glass-blur`，驱动 `--lg-blur-shell` / `--lg-blur-card` |
| 液态玻璃开关 | `dsh-liquid-glass:effect` | 是否启用材质 |
| 边缘折射 | `dsh-liquid-glass.lens.refract`（默认 on） | on 用位移贴图折射岛边缘；off 只剩磨砂 blur，不扭曲背后内容 |

旧键 `dsh-liquid-glass.background.blur` **不再读取**，也不清空。其旧数值不会迁移成玻璃模糊。

## 正文固定外壳

官方 scroll owner 保持不变。ConversationRoot `[data-phase='active']::before` 从 Header 底边一直画到 ConversationRoot 底部，覆盖完整滚动视口；同边界的 `::after` 在文本之上画圆角边框与上下 44px 渐隐遮挡。`shell.overlay` 上的 MetricsBridge 用 ResizeObserver 写入 `--lg-header-height`，并以 `data-conversation-scroll`、`data-composer-seat` 与稳定的 `data-chat-flow` 实际矩形计算内容列上下裁切。滚动事件只经 requestAnimationFrame 更新两个 clip inset；不改 scrollTop、overflow 或 sticky。输入岛处于固定材质之上，不再生成任何白色或不透明遮罩。不替换 ConversationSession，不破坏 ChatView 滚动协议。

## 稳定选择器

| 选择器 | 插件改动 |
| --- | --- |
| `[data-slot="sidebar"] > :first-child` | 透明 + isolation；几何全官方 |
| 同上 `::before` | 展开态玻璃壳 |
| `[data-sidebar-collapsed] …::before` | 只改 inset/radius |
| `[data-slot="conversation"] > [data-phase]` | 透明 host |
| `[data-phase='active']::before` | 固定正文岛 |
| `[data-phase='active']::after` | 固定圆角边框与上下缘遮挡 |
| header `::before` | 标题岛 |
| `[data-composer-card]::before` | 输入岛 |
| `data-chat-flow` | 按真实 scrollport / composer 边界做透明裁切 |
| New Session / selected treeitem / Settings trigger | 展开态统一 38px 高与水平基线；折叠态 36px |
| viewArea | 仅 content padding，不画外壳 |

## 自动测试与视觉

| 项 | 状态 |
| --- | --- |
| 壁纸无全局 filter；玻璃模糊只改 CSS 变量 | 自动测试 |
| 结构祖先无 filter/backdrop-filter | 自动测试 |
| 各岛 ::before 有局部 blur | 自动测试 |
| viewArea 不再画外壳 | 自动测试 |
| 深色壁纸在浅色官方外观下仍选择高对比玻璃文字 | 自动测试 |
| 固定边框/上下遮挡与材质使用相同的完整滚动视口边界 | 自动测试 |
| 设置弹窗打开时释放 SidebarRoot isolation，隐藏侧栏装饰伪元素 | 自动测试 |
| 导入图片先弹自由裁剪（拖动/缩放/比例预设），确认后按原分辨率高质量编码 | 自动测试 |
| 边缘折射开关 off 时岛 `::before` 不再引用位移滤镜，壁纸/内容不被扭曲 | 自动测试 |
| 不存在输入区白色遮罩，且不修改官方 sticky/scroll owner | 自动测试 |
| 正文裁切随 scrollport / composer 实际矩形更新，切页后重新绑定 | 自动测试 |
| 展开侧栏三个胶囊统一基线，折叠态恢复 36px 圆形 | 自动测试 |
| MetricsBridge 生命周期 / 交错 dispose | 自动测试 |
| 折叠冻结宽度不被插件压窄 | 自动测试 |
| 用户截图（模糊 0/20/max、滚动、折叠、设置） | **未做** |
