# `@deepseek-ai/dsh-fanfic`

[English](README.md) | 中文

同人创作能力的 Service Definition。它注册 `ctx.fanfic`、负责 Provider 选择，并定义存储 Provider 与面向模型 Consumer 共用的类型化请求/结果；自身不读取 EPUB，也不持久化分支。

## API

`FanficRuntime.registerProvider()` 通过 Cordis effect 挂载 Provider。未显式配置 Provider id 时，必须恰好有一个可用 Provider；零个或多个都会明确失败。

Service 暴露四组能力：

- 带剧透截止的 canon 搜索/读取/snapshot，以及 timeline 与 causality 查询；
- `expandContext()`、`characterIntelligence()`、`characterVoiceContext()`、`narrativeStyleContext()`、`antiCopyGuard()`、`auditNarrativeStyle()`、`assessPower()`、`impactScan()`，为作者推理与散文修订提供结构化输入；
- `validateEnrichment()` + `commitEnrichment()` 的来源证据校验式 canon enrichment，以及 `planEnrichment()`、`enrichmentProgress()`、`checkpointEnrichment()` 提供可恢复的 chapter×记录类型 digest；
- 可变 fanfic branch、作者意图、持久化 Story Director state/context、Observer/Reflector delta、`authorContext()` 与确定性审计。

Canon 与 fanfic branch 使用不同时间轴。`asOfChapter` 限制原作来源，`fanficChapter` 限制分支状态，因此回改早期同人章节时不会读到后来才记录的事实、知识、关系、因果线程或摘要。记录 divergence 后，`AuthorContext` 还会把绑定的 `canonTruth` 与反事实 `canonReference` 分开。

`AuthorContext` 还会携带经过 cutoff 过滤的 `narrativeStyle`：它来自作品级的句段节奏、对话比例、标点分布与场景模式统计，并只附带少量 cutoff 内证据窗口。该层用于高层写作约束，不把“精确模仿作者”当作目标；全文精确重合由独立 anti-copy guard 检查。

`AuthorContext` 现在还包含带剧透保护的 graph expansion 与来源支撑的人物 dossier；当提供 branch 与 fanfic chapter 时，还会携带紧凑 Story Director packet，把当前 scene 与 active arc、到期 thread、存活 foreshadow、近期已接受章节、未解决 divergence 后果及滚动 chapter horizon 对齐。因此 Composer 不必在调用前就猜中所有相关实体或长篇叙事承诺。

## 质量强制作者工作流（v0.7）

Branch format 升为 v3，`AuthorContext` 升为 version 4。每个分支持有 durable `FanficWritingContract`；已接受 chapter version 会绑定 staged `draftId` 与 `draftHash`。Provider 暴露 `stageDraft()`、`updateDraft()` 与 `getDraft()`，让三类 settlement audit 和最终 commit 都引用同一份持久 prose identity，而不是反复复制整章正文。

Audit receipt 继续绑定 draft/revision/branch，并新增 Writing Contract 绑定。Provider 可以在发放 style receipt 前阻止 prose degeneration，也可以在发放 canon receipt 前强制 author-private mystery reveal condition。Rewrite 的 `inherit`/`replace`、历史 ownership 保护与 Story Director reconciliation 继续作为硬语义。

`AuthorContext` v4 返回 serialization telemetry（实际字符数、hard budget、compaction level 与被省略类别），使 context scaling 可以直接测量而非从日志估算。

## Model Experience

间接地，通过 `@deepseek-ai/dsh-tool-fanfic`；该 Consumer 负责 fanfic prompt policy、tool schema 与渲染结果。

#### KV Cache effect

无直接影响；本 Service Definition 不注册面向模型内容。

## Known Limitations and Deferred Work

- **每次操作选择一个完整 Provider** —— 当前 seam 尚未把 canon search 与 branch storage 拆成独立 Provider；只有真实替换需求出现时再拆。
- **管理型 branch read 不限制 fanfic 时间** —— `getBranch()` 为管理/CAS 写入有意返回完整状态；场景创作必须走 `authorContext(..., fanficChapter)`。
- **Enrichment 校验证据，不等于校验文学解释** —— Provider 能证明引文确实存在并验证结构；语义暧昧的抽取仍可增加第二模型或人工复核。
- **风格指标不是作者仿写器** — 这些指标只做作品级节奏与场景模式诊断；文学质量、角色口吻与细微语感仍需模型结合证据判断。
