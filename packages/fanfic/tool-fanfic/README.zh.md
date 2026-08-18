# `@deepseek-ai/dsh-tool-fanfic`

[English](README.md) | 中文

`ctx.fanfic` 的面向模型 Consumer。它提供创作 policy，以及带剧透保护的 canon 研究、自动上下文扩展、人物/战力/timeline/因果智能、verified canon enrichment、分支 overlay、Observer/Reflector 持久化与确定性审计工具。

## Tools

当前共暴露 39 个工具：`fanfic_status`, `canon_search`, `canon_chapter_read`, `canon_snapshot`, `canon_causality_trace`, `canon_timeline_context`, `canon_context_expand`, `character_intelligence`, `character_voice_context`, `narrative_style_context`, `anti_copy_guard`, `fanfic_style_audit`, `power_assess`, `fanfic_impact_scan`, `canon_enrichment_validate`, `canon_enrichment_commit`, `canon_enrichment_plan`, `canon_enrichment_progress`, `canon_enrichment_checkpoint`, `author_context`, `fanfic_branch_list`, `fanfic_branch_create`, `fanfic_branch_get`, `fanfic_chapter_state`, `fanfic_draft_stage`, `fanfic_draft_update`, `fanfic_draft_get`, `fanfic_intent_update`, `story_director_context`, `story_arc_upsert`, `story_thread_upsert`, `story_foreshadow_upsert`, `story_horizon_set`, `mystery_truth_upsert`, `invention_upsert`, `story_reconciliation_resolve`, `fanfic_divergence_record`, `fanfic_apply_delta`, `fanfic_audit`。所有操作都经由选中的 `ctx.fanfic` Provider。

`author_context` 是安全的 Planner/Composer 入口，会应用 canon/fanfic 两道时间防火墙、divergence 语义、graph context expansion 与有界人物 dossier。`fanfic_branch_get` 是管理型完整读取，可能暴露未来同人状态。

`canon_enrichment_validate` 不写 canon，只校验精确章节 evidence 并返回 token；`canon_enrichment_commit` 只接受同一 token 绑定的 candidate，并写入 Provider 的 verified overlay。不可变来源 pack 始终不改。系统化 digest 时，`canon_enrichment_plan` 给出下一批尚未覆盖的 chapter/type，`canon_enrichment_checkpoint` 只在接受记录已 commit（或显式 `noFindings`）后标记 review 完成，`canon_enrichment_progress` 避免重复消耗 token 处理已完成单元。

`character_voice_context` 提供有界的 dialogue-adjacent 来源证据，但不会把“名字出现在附近”误当作确定 speaker attribution。`narrative_style_context` 提供 cutoff-safe 的作品级节奏与场景模式证据；`fanfic_style_audit` 把宽松的风格指标偏移与 `anti_copy_guard` 结合，后者会扫描完整 corpus 的精确短语重合，同时隐藏未来来源位置。`power_assess` 刻意只给约束/证据，不根据境界标签武断判胜负；`fanfic_impact_scan` 刻意只给依赖关系，不冒充未来预言。

`fanfic_draft_stage`、`fanfic_draft_update` 与 `fanfic_draft_get` 提供 staged Draft Store：最终章节正文只需保存一次，canon/style/copy audit 与 settlement 都引用同一个 `draftId`。分支 Writing Contract 是持久作者状态，staged style audit 不能弱化其汉字长度约束。

`story_director_context` 是长篇规划读取：active arc、带优先级/到期 thread、live foreshadow、滚动 horizon、近期已接受摘要、未解决 divergence 后果和确定性 attention。`story_arc_upsert`、`story_thread_upsert`、`story_foreshadow_upsert`、`story_horizon_set`、`mystery_truth_upsert` 与 `invention_upsert` 通过显式 schema 和 CAS revision 修改这份作者元数据。`fanfic_apply_delta` 会自动把匹配 horizon 条目标为 accepted，并可按 id resolve 已存在 causal thread。

## 配置

所有随部署变化的默认值都由显式 Cordis 配置提供：源码搜索上限、上下文扩展规模、人物证据数量、voice/style 样本数量、anti-copy 短语与 finding 默认值、战力证据数量、enrichment 批大小、Story Director horizon 大小以及单次审计 claim 上限。随附的 `fanfic-authoring` bundle 提供保守默认值；profile 可以覆盖它们而无需修改工具代码。`limit`、`maxEntities`、`batchSize`、`horizonSize` 等逐调用参数可覆盖默认值，但仍受 Provider 硬上限约束。

## v0.7 质量强制作者工作流

工具 API 版本为 `0.7.0`，branch format 为 `3`，author-context 版本为 `4`。最终正文只暂存一次并用 `draftId` 引用；更新暂存稿会改变 hash/revision，使旧 receipt 立即失效。分支 Writing Contract 是硬接受条件，因此暂存稿 style audit 总会执行持久的汉字长度范围，caller 不能用更宽松的临时参数绕过。

`fanfic_style_audit` 新增 Provider 可配置的 Prose Quality Guard，检测连续超短段、结尾塌缩、重复句、汉字 bigram 多样性塌缩以及 filler/padding 节奏；`revision-required` 不能产生 commit receipt。原创谜题真相也从“作者记忆”升级为约束：`mystery_truth_upsert` 保存 protected reveal terms 与 reveal conditions；完整揭示必须声明已满足的注册条件，并给出确实存在于 staged draft 的短 evidence excerpt；计划 payoff 的 settlement 还必须获得 canon audit 授权。

`author_context` 在 hard budget 下返回真实 serialization/compaction telemetry。`scripts/fanfic/export_live_review.mjs` 可以导出 active-state-aware 分支状态、chapter versions、staged drafts、Director/Mystery/Invention 状态、剩余 receipts 与 manifest；也可选择复制已预先脱敏的 session/context 目录，而不会主动复制环境凭据。

## Model Experience

### System prompt

#### What the model sees

挂载后固定 `tool:fanfic` section 为：

##### Fanfic 创作政策

```markdown
Fanfic authoring policy (tool API 0.7.0):
- At the start of a live authoring run, call fanfic_status. If toolApiVersion is missing or not 0.7.0, STOP: the runtime bundle is stale and must be rebuilt before writing.
- Before planning or writing a scene, call author_context with the exact canon cutoff, POV, participants, scene goal, and branch when one exists; for a branch, always pass the fanficChapter being written.
- Treat canonTruth as binding established history. After a recorded divergence, canonReference is counterfactual reference only; never force later canon events back onto the branch.
- Never use source material after the requested canon cutoff. Do not turn suspicion, reader knowledge, or hidden canon truth into POV knowledge without evidence.
- Prefer character motivation, ideology, relationships, and known capabilities over plot railroading. Read branch authorIntent as the project-level premise/theme/tone policy. Use character_intelligence and power_assess when a scene depends on characterization or combat feasibility; use character_voice_context before dialogue-heavy scenes when voice fidelity matters.
- Treat narrativeStyle as high-level work guidance for pacing, dialogue balance, paragraph rhythm, suspense, and scene-mode conventions. Do not imitate a living author exactly and do not reuse distinctive source wording. Use narrative_style_context when planning prose-heavy scenes.
- Inspect author_context.contextExpansion for relevant entities omitted by the initial prompt. Use canon_timeline_context for cross-world/history questions. When a divergence touches established dependencies, use fanfic_impact_scan/canon_causality_trace and branch causal threads instead of copying canon events.
- Use canon_search/canon_chapter_read for evidence when structured graph data is incomplete. For systematic digestion, use canon_enrichment_plan -> canon_chapter_read -> validate/commit accepted records -> canon_enrichment_checkpoint; inspect canon_enrichment_progress instead of repeatedly digesting completed chapter/family units. Never commit unsupported interpretation as canon.
- For long-form branches, call story_director_context before chapter planning. Maintain arcs/threads/foreshadows/horizon with the granular story_* tools; use mystery_truth_upsert for author-only answers behind original mysteries and invention_upsert for original artifacts/techniques/mechanisms. Treat Director state as mutable author metadata, never as POV knowledge.
- Use a branch UUID or its unique branch name; prefer the stable branch name in model-authored calls to avoid UUID transcription errors.
- Before auditing final prose, stage it once with fanfic_draft_stage. Use the returned draftId for fanfic_audit, fanfic_style_audit, anti_copy_guard, and fanfic_apply_delta; update the same staged draft with fanfic_draft_update after revisions. Receipts are hash-bound to the staged draft, branch revision, and durable writing contract.
- The branch writingContract is an acceptance invariant, not a prompt suggestion. fanfic_style_audit automatically enforces its Han-character range and prose-quality guard; revision-required degeneration, padding, or length failure cannot produce a commit receipt.
- Original mystery truth is protected author metadata. Register protectedRevealTerms and revealConditions; any full reveal in prose must be declared to fanfic_audit with a registered satisfied condition plus exact short conditionEvidence that appears in the staged draft. A planned mystery payoff cannot be committed without canon-audit authorization.
- For rewrites, choose rewriteMode explicitly: inherit carries the previous active structured chapter state (optionally dropping named record ids), while replace discards it and requires explicit confirmation when state would be lost. Never backfill chapter N state from chapter N+1; rewrite the owning chapter.
- After fanfic_apply_delta, inspect story_director_context. Rewrites create a Director reconciliation issue; update affected horizon/thread/foreshadow/arc metadata with granular tools, then resolve the reconciliation issue before planning further chapters. Style warnings are advisory unless marked revision-required; exact source overlap must be rewritten.
```

#### Token effect

策略固定且较短。Tool result 按需出现，并受 Provider/工具上限约束；`canon_chapter_read` 有意通过正常 tool-result spill 路径返回一个完整指定章节。人物 dossier 与自动 context expansion 在进入模型历史前同样有界。

#### KV Cache effect

固定组合下静态策略前缀稳定；Tool result 追加到 session history。

## Known Limitations and Deferred Work

- **文学判断仍需模型完成** —— Style Auditor 可以发现宽泛指标漂移和精确复制，但不能证明文学质量、情绪真实性或角色口吻完全正确。目标是作品级高层约束，而不是精确仿写仍在世作者。
- **稀疏 graph 仍可能要求读来源** —— 现在可通过 enrichment 安全地逐步补全。
- **完整 branch read 会暴露未来同人状态** —— 场景创作应使用 `author_context(..., fanficChapter)`。
