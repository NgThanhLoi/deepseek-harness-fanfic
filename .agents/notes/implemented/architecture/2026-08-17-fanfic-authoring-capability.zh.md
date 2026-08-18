# Agent Note: 同人创作以可选 canon/branch capability seam 交付

Status: implemented

[English](2026-08-17-fanfic-authoring-capability.md) | 中文

## 问题

长篇同人创作需要的不只是对原文做检索。Writer 必须区分不可变世界真相、canon 在某个叙事时点已经揭示的内容、当前 POV 实际知道什么，以及同人分支改变了什么。把所有匹配来源 chunk 都视为可用会泄露未来 reveal；分歧发生后继续强制执行后续原作会把分支硬拉回轨道；如果持久化整份同人状态却没有第二个叙事截止点，回改早期章节时还会反向泄露同人自己的未来。

这项能力也必须可替换。Canon 搜索可以从内存章节扫描起步，之后换成 SQLite/FTS、vector 或 remote service；分支存储也可能独立演进。把这些决策直接写进面向模型的 tool 会让创作行为绑定单一存储实现。

## 决策

同人创作由三个 capability 角色和一个可选 bundle 组成：

- `@deepseek-ai/dsh-fanfic` 是 Service Definition 与 Provider registry，通过 `ctx.fanfic` 暴露。
- `@deepseek-ai/dsh-fanfic-local` 是首个文件系统 Provider，负责不可变 canon pack 与可变 branch snapshot。
- `@deepseek-ai/dsh-tool-fanfic` 是面向模型的 Consumer 与固定创作策略。
- `@deepseek-ai/dsh-fanfic-authoring` 通过 patch layer 挂载三者，不修改 agent-loop。

Local Provider 把来源 canon 保持只读。所有可变内容写入以 branded `FanficBranchId` 标识的 branch JSON；写入使用 compare-and-set revision 与原子替换。`authorIntent` 把 premise、divergence mode、theme、tone、POV policy、character priority、forbidden outcome、style note 作为分支自己的策略，与 canon fact 分开。

### 两道时间防火墙

Canon 和 fanfic 使用不同的时钟。

`asOfChapter` 是 canon 防火墙。来源搜索会在评分前删除截止点后的章节。结构化 fact、identity、power、relationship、event、timeline rule 与 POV knowledge 都按时序有效性过滤。`revealFromChapter` 允许某个世界事实更早成立，但在 canon 正式揭示之前不向作者/模型暴露。

`fanficChapter` 是 branch 防火墙。针对同人第 N 章请求的 author context 或 branch-aware audit，只保留 N 时点已存在的 overlay fact、knowledge、character state、relationship、causal thread 与 chapter summary。因此写到第 50 章后回改第 10 章，安全创作路径也不会把第 50 章的 branch state 泄露回来。

完整 `getBranch()` 有意作为管理操作返回全部持久分支，供管理和 CAS 写入使用。面向模型的描述要求写场景时使用 `author_context`，而不是 raw branch reader。

### Divergence 语义

Divergence 记录分支从哪个 canon 叙事章节起不再把后续原作事件视为约束。`author_context` 取最早 divergence：其前的 canon 作为 `canonTruth`；若请求时点更晚，后续来源状态单独作为 `canonReference` 返回，并显式标记为 counterfactual。

Audit 使用同样的切分。分歧之后的原作 reveal 本身不能证明分支事实或 POV knowledge。后续 canon 的 identity/power 只能产生要求 branch evidence 的 warning；没有 branch epistemic state 的 POV knowledge claim 仍然是 error。结构化 fanfic knowledge 除 summary 外可携带 subject/predicate/object，使审计无需依赖 prose 匹配即可证明同人来源的知识。

### 稀疏且已验证的 canon graph

随附的《一世之尊》pack 包含确定性来源章节与刻意保持稀疏的结构化 graph。Seed 生成在接纳每条 graph row 前校验精确 EPUB SHA、chapter SHA 与预期 evidence phrase。缺少结构化数据表示“未验证”，而不是“为假”；source search/read 仍是回退真源。

因此未来的大规模 enrichment 路径应为：模型提议 → 引用章节 → 获取不可变来源 → 验证 → graph admission。直接把 LLM 批量抽取结果写成 canon truth 不属于本实现。

### Verified enrichment 与作者智能

稀疏 graph 现在拥有位于 Provider state 中的可写 verified overlay，而不是写回不可变 canon pack。Candidate 携带记录类型、来源章节、精确 evidence 摘录与结构化 payload。`validateEnrichment()` 证明 evidence 确实存在于该章节、执行普通 canon record parser，并返回绑定 candidate、source SHA 与 chapter SHA 的 token。`commitEnrichment()` 会重新计算 token、拒绝重复 id、串行化并发接纳、要求 knowledge row 引用已存在 fact，并只追加带 Provider 派生 provenance 的 materialized record。Provider 下次加载时按 id 合并 base 与 verified rows。

Evidence validation 能证明 provenance 与结构合法性，但不会宣称每句暧昧文本只有一种语义解释；重要歧义仍应使用第二模型或人工复核。

Author context 还增加了带剧透保护的发现层。Graph expansion 沿已揭示身份、时序关系、共同事件、可见 fact edge 与相关 causal record，找出初始 prompt 未点名但可能相关的实体。`author_context` 使用这些实体组合绑定 canon，并携带有界人物 dossier。专门的 character、power、timeline 与 divergence-impact 查询只暴露证据与明确 data gap，不补造 lore。Power assessment 刻意提供约束而不是把修炼境界换算成数值胜率；impact scan 刻意做依赖发现而不是预言。

### 可恢复的 canon enrichment orchestration

只有 verified-record overlay 仍无法解决长任务协调：agent 可能忘记哪些章节、哪些 record family 已经 review，反复消耗 token 处理同一来源。Local Provider 因此在 `<stateDir>/enrichment/coverage.ndjson` 维护独立 enrichment coverage ledger，以 source chapter × canon record family 为键。Checkpoint 保存不可变 source/chapter hash，以及已接纳 record id，或显式 `noFindings`。

`planEnrichment()` 在有界范围内返回下一批尚未覆盖的 chapter/family；`enrichmentProgress()` 把 append-only checkpoint ledger 折叠为每个 key 的最新有效记录；`checkpointEnrichment()` 只接受确实存在于所选 record family、且 provenance 指向精确 review chapter 的 admitted id，`noFindings` 与 id 互斥。因此 checkpoint 只证明“该抽取 pass 已 review 这个单元”，不证明“章节全部语义真相都已结构化”。模型仍必须读取章节、验证并 commit 有来源支撑的 record，然后再 checkpoint。

### 长篇 Story Director 与声音证据

Fanfic branch 现在携带 `storyDirector`，它是与 canon 和 branch 世界事实分离的持久化作者元数据，保存 arc、带优先级的 plot/character/mystery/relationship/theme thread、foreshadow/payoff 承诺和滚动 chapter horizon。`storyDirectorContext()` 派生活跃/到期事项、近期已接受摘要、未解决 branch causal thread，以及确定性 attention，例如某个高优先级 thread 已进入 horizon 却没有任何 plan advance，或 planted foreshadow 已超过目标 payoff 章节。

Director 明确不是预言：planned beat 可以指向未来 fanfic chapter，因为它是作者意图，但不能建立世界真相或 POV knowledge。当请求同时带 branch 与 fanfic chapter 时，`author_context` 会加入紧凑 Director packet。`fanfic_apply_delta` 在章节 settlement 后自动把匹配 horizon 条目标为 accepted，并可按 id resolve 已存在 causal thread，避免旧实现“再追加一个 disconnected resolved row，但原 open thread 仍然活着”的问题。新的后果可以让后续 horizon 失效并被替换，而无需改写 branch truth。

`characterVoiceContext()` 增加另一条作者证据路径：在 canon cutoff 内返回结构化 `voiceNotes`，以及人物出现位置附近的有界来源窗口和 dialogue fragment。由于文本邻近不等于可靠 speaker attribution，结果明确只是 contextual evidence；有歧义的 fragment 必须通过来源章节再确认，才能升级成持久 voice rule。

### 作品级叙事风格与精确重合防护

人物声音证据本身不足以描述叙述方式、场景节奏、对话密度、段落韵律或悬念推进。Canon pack 因此可以包含 `style/style-bank.json`：这是绑定 source SHA 与每章 SHA 的无正文派生索引。每行只保存章节级节奏指标，以及江湖、悬疑、轮回任务、吐槽/内心戏、战斗、高层博弈、宇宙/理念、解释、群像/传闻、情感等宽泛 scene mode 的启发式分数。这些 mode 只是检索提示，不声称一章只有一种类型。

`narrativeStyleContext()` 会先应用 canon cutoff 再选择参考章节，聚合作品级指标，只返回少量 cutoff-safe 来源窗口，并合并 branch 的 `authorIntent.styleNotes`。`author_context` 默认嵌入该 packet，因此普通 Planner/Composer 不必额外调用 style lookup。指导目标是作品层面的高层特征，而不是精确复刻仍在世作者的独特表达。

`auditNarrativeStyle()` 把草稿与选定参考 envelope 比较。指标漂移仅是建议，因为均值相近不能证明文学质量。原文精确复用则属于另一条 invariant：`antiCopyGuard()` 规范化空白后，把草稿与完整不可变 corpus 做精确重合扫描。为了抓住模型记住的未来原文，它可以扫描 `asOfChapter` 之后的章节，但未来命中只报告“位于 cutoff 之外”，不返回来源章号。Finding 只携带草稿侧重合与 fingerprint，不返回来源正文，因此 anti-copy 检查不能被当成剧透 oracle。

## 曾考虑的替代方案

**把所有逻辑塞进一个面向模型的 tool plugin。** 否决：会耦合来源索引、branch persistence 和作者策略，无法替换 Provider。

**只用一个 vector database，再提示模型不要读未来 chunk。** 否决：剧透安全会依赖模型遵守提示。来源截止必须在 ranking 前执行，结构化 reveal 也要有独立 author-visible 时间。

**分歧后继续沿用后续 canon，只覆盖改变的 fact。** 否决：后续 canon event 依赖的条件可能已被分支破坏。分歧后的原作是有用的反事实参考，不是预言。

**每个场景都暴露完整 branch state。** 否决：常见的回改工作流会把同人自己的未来泄露进早期章节。

**让 LLM 自动把整本小说抽成结构化真相。** 首版 Provider 不采用：静默抽取错误比数据稀疏更危险；来源文本保持权威，enrichment 必须保留 provenance。

## 验证

无密钥 real-pack smoke 加载全部 1,409 个《一世之尊》派生章节，验证来源 cutoff、真慧/杨戬 reveal 边界、POV knowledge 时序、确定性 premature-reveal audit、来源支持的因果、graph context expansion、character/voice/style/power/timeline/impact intelligence、cutoff-safe style reference、可见/未来 exact-copy 检测及未来位置隐藏、token-bound enrichment admission、enrichment planning/progress/checkpoint 语义、author intent、Story Director 持久化/attention、divergence 到 counterfactual 的转换、branch delta persistence、causal-thread resolution、horizon 自动 settlement、stale revision 拒绝，以及 fanfic chapter 的反向泄露防护。它还验证：较早分歧后，较晚 canon reveal 只产生 counterfactual warning；只有 branch 独立持久化匹配的 fact 与 knowledge 后，该 reveal 才在分支中成立。

Synthetic Vitest suite 不依赖小说 pack，覆盖同样的时序隔离。fanfic Service Definition、local Provider 与面向模型 Consumer 在当前 sandbox 内通过 focused TypeScript project build。完整 pnpm repo gate 需要正常 dependency install 与受支持 Node 版本；当前 sandbox 无法解析 npm registry。

## 结果

Writer 面向的安全原语仍是 `author_context`，而不是裸 retrieval。它现在组合已成立 canon、POV epistemics、branch intent/state、有界 Story Director context、cutoff-safe narrative-style guidance、需要时的 counterfactual reference 与显式约束，不修改 agent loop。系统化 canon digest 则通过 enrichment coverage ledger 独立恢复，而不是依赖模型记忆。

首个 Provider 刻意简单：内存 source scan + JSON branch file。这些选择现已封装在 `ctx.fanfic` 后面，未来 indexed/remote Provider 可以替换 acquisition 和 persistence，而不改变 tool vocabulary 或 authoring policy。确定性 audit 仍是 guardrail，不替代模型对人物声音、理念、节奏和因果合理性的判断。风格指标只做诊断，不用于精确作者仿写；全文精确重合由独立 source-copy guard 处理。

## 长篇正确性修订

第一次真实模型运行暴露了仅靠无密钥 happy-path 测试很难发现的正确性问题：重写已经接受的章节会产生重复 active 状态，并让旧稿污染新稿；只按章节号记录分歧会丢掉同一原文章节中分歧点之前已经成立的事件；草稿审计依赖 Writer 自己列出高风险 claim；一个模糊的 Story Director 大对象迫使模型通过连续报错反推嵌套 schema；风格验收则把标点也计入长度，而且对段落/对白节奏漂移的权重不足。

分支格式 v2 通过 active/superseded 章节版本处理重写。每条同人覆盖层记录都指向其来源章节版本；规划或审计同人第 N 章时，会排除由第 N 章旧版本产生的状态。因果线程的“已解决”属于解决它的章节版本效果，并根据当前 active 版本重新物化，因此替换该章节可以恢复此前的开放状态，而无需保存同 ID 的重复线程记录。旧 v1 JSON 会在内存中迁移，并在下一次写入时保存为 v2。

Canon 分歧现在可以用 `afterEventId`/`eventOrdinal` 指向结构化事件边界。更早且完全稳定的章节仍属于 `canonTruth`；分歧章内带 provenance、且事件顺序不晚于边界的记录组成 `canonSameChapterTruth`；整章只保留为反事实 `canonReference`，不会把同章剩余原文越过边界提升为真相。真实 canon pack 中的关键 reveal 事件也已补充事件顺序与 provenance，以便执行该语义。

草稿审计现在会根据参与者以及高风险的能力动作、知识、身份和世界事实措辞独立抽取 claim。Writer 主动提交的 claim 仍然有用，但独立抽取中未覆盖的 claim 会形成明确的 audit coverage finding，并在可行时继续做结构化校验。这不是语义证明器；目标是防止 Writer 通过“不申报”来定义自己的审计范围。

Story Director 写入拆分为显式 schema 的 arc/thread/foreshadow/horizon 工具，并新增作者私有的 Mystery Truth Ledger 与带能力/限制/代价的 Invention Registry。存在 active mystery thread 却没有作者真相时会产生确定性 attention。风格指标 schema v2 新增汉字数、段落长度中位数和短段落比例；可选汉字长度目标属于硬验收条件，而节奏偏差仍是建议。模型侧写工具改为紧凑返回，并新增构建预检，检查工具 API `0.6.0` 及已构建工具清单，在真实模型运行前阻止“源码新、runtime lib 旧”的情况。

## 事务化作者工作流修订

Long-form correctness 版本之后的一次三章真实模型运行暴露了另一类问题：chapter-version projection 已能正确隐藏 superseded state，但如果重写只提交新的 summary，旧版本拥有的结构化 facts/knowledge 会被无意丢失，模型随后甚至尝试在第二章重新补写第一章历史状态。同一次运行还表明，在每个工具调用中复制 opaque branch UUID 会直接造成 continuity failure；重写后 Story Director 元数据可能保持旧计划；仅靠 prompt 约束也无法阻止模型持久化 style audit 已失败的稿件。

因此章节结算改为显式事务。canon audit、narrative-style audit 与 anti-copy audit 只有在通过时才可签发 receipt。每份 receipt 绑定最终稿的精确 hash、branch id、fanfic chapter 与 branch revision。`fanfic_apply_delta` 必须同时拿到三种 receipt，并且只在 branch 写入成功后消费。稿件被修改、branch revision 过期、审计失败或 receipt 已消费时，都不能授权持久化。

重写显式选择 `inherit` 或 `replace`。`inherit` 先把上一 active chapter version 拥有的结构化记录克隆到 replacement，再应用显式删除和新增记录。`replace` 故意从空的 chapter-owned state 开始；如果上一版本拥有结构化记录，则必须确认会丢弃这些状态。ownership 字段必须与正在结算的章节一致，因此后续章节不能静默回填前面章节。`fanfic_chapter_state` 可以在重写前读取 active chapter-owned record ids，同时不会暴露后续同人历史。

每次重写还会创建 durable Story Director reconciliation item。规划元数据不会因为新 prose 自动变化；作者需要通过 granular arc/thread/foreshadow/horizon 工具明确更新，并在接受新计划后调用 `story_reconciliation_resolve` 关闭 issue。模型侧 branch reference 既可使用 branded id，也可解析唯一 branch name；推荐使用稳定名称来避免 UUID 抄写错误。

Author packet 升级为 version 3，并受配置的序列化 hard size ceiling 约束。压缩先移除可选 source/style evidence，再限制 structured snapshot families、人物 dossier、branch working rows 与 Director rows。如果 Provider 无法在配置上限内生成可用 packet，它会直接失败，而不会静默突破 deployment policy。完整 evidence 与管理型 branch history 仍可通过显式读取获得。

真实运行中的 false positive 也促使 independent audit extraction 收紧：普通兵器探查不属于超自然 power claim，诸如 `身份牌` 的词汇出现也不属于 identity assertion；更强的 capability/identity 线索仍会进入 uncovered-risky-claim audit。核心 style drift 可升级为 `revision-required`，这种结果不能签发章节结算所需的 style receipt。Tool API `0.6.0` 与 runtime bundle preflight 让这些行为在挂载模型之前即可验证。
