# `@deepseek-ai/dsh-fanfic-local`

[English](README.md) | 中文

`ctx.fanfic` 的文件系统 Provider。它读取不可变原作 canon 与单独持久化的 verified-enrichment overlay，在检索前执行叙事截止，组合作者智能，并用原子 compare-and-set snapshot 存储可变同人分支。

## Canon pack 与 verified enrichment

必需 pack 文件为 `manifest.json`、`source.json`、`chapters.ndjson`。`graph/` 下可选基础结构化文件包括 `facts.ndjson`、`knowledge.ndjson`、`characters.ndjson`、`identities.ndjson`、`powers.ndjson`、`relationships.ndjson`、`mysteries.ndjson`、`events.ndjson`、`timeline-rules.ndjson`、`causality.ndjson`。

基础 pack 永不修改。模型辅助 enrichment 只写入 `<stateDir>/enrichment/graph/`。`validateEnrichment()` 必须先证明声明的 evidence 确实出现在指定不可变来源章节中，而且 candidate 能通过与 canon pack 相同的记录 parser。验证 token 绑定标准化 candidate、source SHA 与 chapter SHA；`commitEnrichment()` 会重新计算 token、拒绝重复 id，并在下次加载时把通过的记录与基础 graph 合并。Knowledge enrichment 必须引用已经接纳的 fact。

因此 LLM 抽取只会形成“有来源证据的结构化 overlay”，而不会静默改写 canon。`fanfic_status` 同时报告合并后的 graph 总量与独立 enrichment 数量。

### Enrichment orchestration

Provider 还持久化 `<stateDir>/enrichment/coverage.ndjson`。Checkpoint 以来源 chapter × 记录类型（`fact`、`knowledge`、`character`、`identity`、`power`、`relationship`、`mystery`、`event`、`timeline-rule`、`causal-link`）为键，记录精确 source/chapter hash，以及已接纳 record id 或显式 `noFindings`。`planEnrichment()` 返回尚无有效 checkpoint 的下一批章节/类型；`enrichmentProgress()` 汇总 coverage；`checkpointEnrichment()` 会拒绝不存在于选定类型、或 provenance 来自其他章节的 record id。Coverage 只表示“该抽取 pass 已 review 这个单元”，不表示“章节中所有真相都已经结构化”。

`revealFromChapter` 把世界真相与作者可见真相分开；POV knowledge 再独立过滤。来源搜索在评分前应用 `asOfChapter`，未来章节无法进入排序。

## Author intelligence

`expandContext()` 沿已揭示身份、时序关系、共同事件、可见事实和相关因果链接发现初始 scene prompt 没点名的实体。`authorContext()` 先做 expansion，再组合 canon snapshot，并带回有界人物 dossier。

`characterIntelligence()` 汇总人物时序状态、可用的 values/ideology/decision notes、身份、关系、知识、能力、分支 overlay 与来源证据；缺少的类别会明确标成 gap，而不是补写。`characterVoiceContext()` 返回人物名字附近的有界来源窗口、dialogue fragment 与结构化 `voiceNotes`；邻近关系只作为上下文证据，不自动断言片段一定由该人物说出。

`assessPower()` 返回角色能力状态、体系规则、timeline rule 与来源证据，只约束场景，不根据境界标签武断判胜负。`timelineContext()` 把叙事章节截止与 worldline/历史规则分开。`impactScan()` 查找相关 canon 因果链接/事件、邻接实体和未解决分支因果线程，并明确只做 dependency scan，不冒充预言。

## Branch storage

分支位于 `<stateDir>/branches/<FanficBranchId>.json`。Divergence、作者意图替换、Story Director 替换与 Observer/Reflector delta 都要求预期 revision。分支拥有独立叙事时钟；branch-aware context/audit 会隐藏未来同人章节状态。记录 divergence 后，后续原作只作为反事实参考，除非分支状态独立重新建立相应事实。

`storyDirector` 是持久化作者元数据，保存 arc、带优先级的 story thread、foreshadow/payoff 承诺和滚动 chapter horizon。`storyDirectorContext()` 派生活跃/到期事项与确定性 attention，例如已经过期的 planted clue，或高优先级 thread 没被 horizon advance。Plan 不是世界真相。`fanfic_apply_delta` 接受章节后会自动把对应 horizon 项标为 accepted，并可按 id 真正 resolve 已存在的 branch causal thread，而不是追加一条彼此无关的“resolved”记录。

## Model Experience

间接地，通过 `@deepseek-ai/dsh-tool-fanfic`。

#### KV Cache effect

无直接影响；只有 Consumer 渲染结果进入模型历史。

## Known Limitations and Deferred Work

- **内存来源搜索** —— 应用剧透截止后扫描章节；以后可换 SQLite/FTS/vector/remote Provider，而不改 Consumer。
- **结构化 graph 仍稀疏** —— 缺行时来源文本才是权威；确定性审计把 claim 标为未验证，而不是判假。
- **Evidence validation 刻意保持机械** —— 它证明来源存在与 schema 完整，不证明一句暧昧文本只有一种解释。

## Narrative Style Bank 与防复制

可选的 `style/style-bank.json` 是绑定 source SHA 与逐章 SHA 的无正文派生索引，只保存句长、段落长度、对话比例、问号/感叹号/省略号比例以及场景模式启发式分数，不保存长篇“模仿样本”。`scripts/fanfic/build_style_bank.py` 可以从 `chapters.ndjson` 重建；文件缺失时 Provider 会在内存中生成等价数据。

`narrativeStyleContext()` 会先应用 `asOfChapter` 再选择参考章节，返回作品级节奏指标、少量 cutoff 内证据窗口以及 branch 的 `authorIntent.styleNotes`。它用于控制节奏、对话/叙述平衡、段落密度和悬念强度，而不是要求精确仿写仍在世作者。

`antiCopyGuard()` 会把草稿与完整不可变 canon 做规范化后的精确短语重合检查。为了抓到模型记忆中的原文，它也扫描 cutoff 后的章节，但若命中未来 canon，只报告 `beyondCutoff=true` 而不泄露章节位置。`auditNarrativeStyle()` 把宽松的指标偏移警告与该防复制结果合并；指标偏移只做修订提示，长段精确重合则要求改写。

## v0.6 事务化 Provider 行为

章节结算现在是事务化操作。canon/style/anti-copy 审计通过后可签发短期 receipt，receipt 绑定最终稿 hash、branch id、fanfic chapter 与 branch revision；`applyDelta()` 必须同时收到三种不同 receipt，并且只在原子写入 branch 成功后消费。这样模型无法把审计失败的稿件，或审计后又被修改的稿件直接持久化。

重写必须声明 `inherit` 或 `replace`。`inherit` 会把上一 active 版本拥有的章节结构化记录克隆到新版本，除非显式提供需要删除的 record id；`replace` 从空状态开始，如会丢弃 active structured state 则必须显式确认。后续章节不能回填前面章节的 ownership 字段。重写会创建 durable Story Director reconciliation issue。Provider 还会分阶段压缩 `authorContext()` 到配置的 JSON 字符 hard ceiling，来源证据和完整管理型 branch 状态仍通过按需读取获得。
