# 同人写作（Fanfic Authoring）

[English](fanfic.md) | 中文

`ctx.fanfic`（[`@deepseek-ai/dsh-fanfic`](../../packages/fanfic/fanfic)）是选择启用的同人写作 seam：不可变的原作正典加上可变的作者分支，提供防剧透查询、可验证的结构化补全与事务化章节结算。它只能通过 [fanfic-authoring bundle patch](../../packages/bundle/fanfic-authoring) 加载，绝不会出现在基础组合中。

[包 README](../../packages/fanfic/fanfic/README.md) 负责组合与服务配置，[`@deepseek-ai/dsh-fanfic-local`](../../packages/fanfic/fanfic-local/README.md) 负责基于随附 [《一世之尊》正典包](../../canon-packs/yishizhizun) 的仓库内提供方，39 个直接工具与 3 个分布式编排工具收录在[工具 Schema 目录](../tool-catalog.md#deepseek-aidsh-tool-fanfic)。下面由生成器产出的 Cordis API 记录面向提供方的分派服务契约，是每个操作的方法级权威。

## 正典与分支

服务注册提供方实现，并把每次调用分派给恰好一个可用的提供方。只读正典访问、分叉检查和分支状态写入都留在该提供方 seam 之后，因此工具 schema 与提供方无关，消费方不依赖存储布局。

不可变正典是 1,409 章的原作包；分支是锚定在正典之上的可变作者状态。`fanfic_branch_create` 为分支命名，每条分支写入都携带 compare-and-set 修订号，让冲突的并发写入显式失败，而不是被静默覆盖。

## 截止点与 POV 知识

每次读取都由两个独立的截止点限定。`asOfChapter` 限定不可变正典的叙事；`fanficChapter` 限定可变分支。未来的源内容在排序前就被排除，因此查询永远不会泄漏截止点之后的章节。

正典真相在其截止点内约束作者所依据的既定历史；记录分叉之后，`canonReference` 仅作反事实参考。没有源证据，读者知识和隐藏的正典真相永远不会变成 POV 知识，`character_intelligence` 只记录带有证据链的事实。

## 可验证的结构化补全

`canon_enrichment_validate` 将建议的结构化记录与确切的章节摘录比对，只有证据与结构都验证通过时才返回验证令牌；`canon_enrichment_commit` 把绑定令牌的记录写入提供方覆盖层，绝不写入基础包。`canon_enrichment_plan` 产生确定性的章节工作队列，`canon_enrichment_checkpoint` 标记已审核的单元，使 `canon_enrichment_progress` 报告已持久化的覆盖率，而不是重复消化。

## Story Director

对于长分支，`story_director_context` 围绕一个同人章节组合当前活跃的 arc、线索、伏笔、滚动地平线（horizon）与关注项。arc、线索、伏笔、地平线、仅作者可见的谜题真相以及原创设定都是可变的作者元数据，通过细粒度的 `story_*`、`mystery_truth_upsert` 和 `invention_upsert` 工具管理；它们永远不会成为 POV 知识。

## 章节结算

最终正文先通过 `fanfic_draft_stage` 暂存一次，获得持久的 `draftId`、修订号与 SHA-256；`fanfic_draft_update` 替换已暂存草稿中的正文，并使针对旧文本签发的收据失效。`fanfic_audit`、`fanfic_style_audit` 与 `anti_copy_guard` 各自返回一个确定性收据，收据绑定该草稿哈希、分支修订号与分支的写作契约；`fanfic_apply_delta`（或一次重写）要求同一草稿的三张收据全部通过。临时文本仍可检查，但无法获得提交收据。重写选择 `inherit`（继承上一份活跃的结构化章节状态）或 `replace`（丢弃该状态，若状态会丢失则要求显式确认）；把后一章的状态反向补进前章会被拒绝。重写之后的元数据编辑通过 `story_reconciliation_resolve` 显式对账。

## 写作契约（Writing Contract）

每个分支都持久保存一份写作契约——默认 `zh-CN`、2,500–4,000 个汉字、`auto` 风格模式——随作者意图通过 `fanfic_intent_update` 一起携带。即使调用方传入更弱的临时限制，`fanfic_style_audit` 也会强制执行该契约，把风格收据绑定到契约哈希，并拒绝超出汉字范围的草稿，因此契约变更后无法复用旧收据完成结算。

## 文风质量守卫

`fanfic_style_audit` 会确定性检查连续的极短段落、结尾塌缩、规范化后的重复句、长草稿上的汉字双字组多样性塌缩以及重复的填充语节奏。标记为必须修订的退化、填充或长度失败无法签发风格收据；阈值属于提供方配置，而不是源码常量。

## 谜题揭露守卫

原始谜题真相可以注册 `protectedRevealTerms` 与 `revealConditions`。正文中的完整揭露必须向 `fanfic_audit` 声明，指明一个已注册且满足的条件，并附上确实出现在已暂存草稿中的精确短句 `conditionEvidence`；未声明或伪造证据的揭露会被拒绝，相关的预定 payoff 只有在正典收据显式授权该谜题 id 时才能结算。

## 版本

磁盘上的分支为 format 3，作者上下文数据包为 version 4，工具 API 为 0.8。由于 DeepSeek Harness 仍属预发布阶段，v0.8 分支会拒绝较旧的磁盘格式而非迁移它们；实时测试应使用全新状态。

## 分布式 Author Brain

`@deepseek-ai/dsh-tool-fanfic-distributed` 直接消费现有 `ctx.fanfic` 与 `ctx.subagents` seam，不新增 service。父级 Author Agent 保持最终权威；`fanfic_prepare_chapter` 并行分发有界、只读的 canon/character/story specialist，`fanfic_review_draft` 则针对当前 staged draft 分发独立 critic。Worker pool 可以选择不同 child LLM route，并使用有序 fallback 与进程内 cooldown；成功 packet 按 branch revision 或 draft hash 缓存。Specialist 使用强制 allow-only tool scope，不能修改 fanfic state、取得 commit 权限或递归调用 subagent control。

只有当部署中的 worker 实际消耗独立 provider/model quota 时，这种分发才会降低 Author model 的研究/审稿 rate-limit 压力。多个 worker 共用一个 credential 不会创造额外限额。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxfanfic--fanficruntime"></a>

### `ctx.fanfic` — `FanficRuntime`

Fanfic runtime selecting one registered provider without binding consumers to storage.

```ts cordis-catalog
/**
 * Register one provider for this service lifetime.
 * @param provider - provider implementation to register.
 * @returns disposer that unregisters this provider contribution.
 */
registerProvider(provider: FanficProvider): () => void

/**
 * Return active provider and canon-pack status.
 * @param signal - cancellation signal.
 * @returns provider status.
 */
status(signal?: AbortSignal): Promise<FanficStatus>

/**
 * Search spoiler-safe source canon.
 * @param request - bounded search request.
 * @param signal - cancellation signal.
 * @returns matching source excerpts.
 */
search(request: CanonSearchRequest, signal?: AbortSignal): Promise<readonly CanonSearchHit[]>

/**
 * Read one source chapter under a spoiler cutoff.
 * @param request - chapter read request.
 * @param signal - cancellation signal.
 * @returns source chapter.
 */
readChapter(request: CanonChapterReadRequest, signal?: AbortSignal): Promise<CanonChapter>

/**
 * Compose canon state at one narrative point.
 * @param request - snapshot request.
 * @param signal - cancellation signal.
 * @returns spoiler-safe snapshot.
 */
snapshot(request: CanonSnapshotRequest, signal?: AbortSignal): Promise<CanonSnapshot>

/**
 * Compose writer-facing canon and branch context.
 * @param request - scene context request.
 * @param signal - cancellation signal.
 * @returns author context packet.
 */
authorContext(request: AuthorContextRequest, signal?: AbortSignal): Promise<AuthorContext>

/**
 * Query source-backed causal links.
 * @param request - causal query.
 * @param signal - cancellation signal.
 * @returns bounded causal trace.
 */
traceCausality(request: CanonCausalityTraceRequest, signal?: AbortSignal): Promise<CanonCausalityTrace>

/**
 * Query worldline/timeline rules, relevant events, and source evidence at one cutoff.
 * @param request - timeline/worldline query.
 * @param signal - cancellation signal.
 * @returns bounded timeline context.
 */
timelineContext(request: CanonTimelineContextRequest, signal?: AbortSignal): Promise<CanonTimelineContext>

/**
 * Expand explicit scene entities through spoiler-safe structured graph edges.
 * @param request - seed entities and cutoff.
 * @param signal - cancellation signal.
 * @returns discovered related entities with reasons.
 */
expandContext(request: CanonContextExpansionRequest, signal?: AbortSignal): Promise<CanonContextExpansion>

/**
 * Build one source-backed character dossier at the requested cutoff.
 * @param request - character dossier request.
 * @param signal - cancellation signal.
 * @returns temporal state, epistemics, relationships, powers, evidence, and gaps.
 */
characterIntelligence(request: CharacterIntelligenceRequest, signal?: AbortSignal): Promise<CharacterIntelligence>

/**
 * Return bounded source-backed dialogue/voice evidence for one character.
 * @param request - character, cutoff, and sample limit.
 * @param signal - cancellation signal.
 * @returns contextual source windows and structured voice notes.
 */
characterVoiceContext(request: CharacterVoiceContextRequest, signal?: AbortSignal): Promise<CharacterVoiceContext>

/**
 * Compose cutoff-safe work-level narrative rhythm and scene-mode evidence.
 * @param request - scene mode, cutoff, participants, and sample limit.
 * @param signal - cancellation signal.
 * @returns high-level narrative style context.
 */
narrativeStyleContext(request: NarrativeStyleContextRequest, signal?: AbortSignal): Promise<NarrativeStyleContext>

/**
 * Detect exact draft overlap against immutable source text without exposing future-source locations.
 * @param request - draft, cutoff, and overlap thresholds.
 * @param signal - cancellation signal.
 * @returns corpus-wide anti-copy findings.
 */
antiCopyGuard(request: AntiCopyGuardRequest, signal?: AbortSignal): Promise<AntiCopyGuardResult>

/**
 * Audit high-level narrative drift and accidental source overlap.
 * @param request - draft plus style-context and anti-copy settings.
 * @param signal - cancellation signal.
 * @returns quantitative style and anti-copy findings.
 */
auditNarrativeStyle(request: NarrativeStyleAuditRequest, signal?: AbortSignal): Promise<NarrativeStyleAuditResult>

/**
 * Assess known power constraints without inventing a fight winner.
 * @param request - actors, scenario, and cutoff.
 * @param signal - cancellation signal.
 * @returns evidence-first capability assessment.
 */
assessPower(request: PowerAssessmentRequest, signal?: AbortSignal): Promise<PowerAssessment>

/**
 * Scan canon dependencies and branch threads affected by a proposed divergence.
 * @param request - proposed change, entities, and cutoff.
 * @param signal - cancellation signal.
 * @returns relevant dependencies and open branch threads.
 */
impactScan(request: FanficImpactScanRequest, signal?: AbortSignal): Promise<FanficImpactScan>

/**
 * Validate a structured enrichment candidate against immutable chapter evidence.
 * @param candidate - source-backed candidate to validate.
 * @param signal - cancellation signal.
 * @returns evidence result and token when valid.
 */
validateEnrichment(candidate: CanonEnrichmentCandidate, signal?: AbortSignal): Promise<CanonEnrichmentValidation>

/**
 * Commit a token-bound verified enrichment record into the provider overlay.
 * @param request - candidate plus validation token.
 * @param signal - cancellation signal.
 * @returns committed record metadata.
 */
commitEnrichment(request: CanonEnrichmentCommitRequest, signal?: AbortSignal): Promise<CanonEnrichmentCommitResult>

/**
 * Plan the next source chapters requiring structured enrichment review.
 * @param request - chapter range, record families, and batch size.
 * @param signal - cancellation signal.
 * @returns deterministic enrichment work queue.
 */
planEnrichment(request: CanonEnrichmentPlanRequest, signal?: AbortSignal): Promise<CanonEnrichmentPlan>

/**
 * Report persisted enrichment coverage over a chapter range.
 * @param request - chapter range and record families.
 * @param signal - cancellation signal.
 * @returns aggregate coverage and effective checkpoints.
 */
enrichmentProgress(request: CanonEnrichmentProgressRequest, signal?: AbortSignal): Promise<CanonEnrichmentProgress>

/**
 * Mark one chapter/record-family review complete after verified records have been admitted.
 * @param request - reviewed chapter, family, admitted ids, and review notes.
 * @param signal - cancellation signal.
 * @returns persisted coverage checkpoint.
 */
checkpointEnrichment(request: CanonEnrichmentCheckpointRequest, signal?: AbortSignal): Promise<CanonEnrichmentCoverage>

/**
 * List persisted fanfic branches.
 * @param signal - cancellation signal.
 * @returns branch snapshots.
 */
listBranches(signal?: AbortSignal): Promise<readonly FanficBranch[]>

/**
 * Create one branch over immutable canon.
 * @param request - branch creation request.
 * @param signal - cancellation signal.
 * @returns created branch.
 */
createBranch(request: CreateFanficBranchRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Read the full administrative branch state.
 * @param id - branch id.
 * @param signal - cancellation signal.
 * @returns branch snapshot.
 */
getBranch(id: FanficBranchId, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Record a canon divergence using CAS revision.
 * @param request - divergence write.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
recordDivergence(request: RecordFanficDivergenceRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Replace branch author intent using CAS revision.
 * @param request - intent update.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
updateIntent(request: UpdateFanficIntentRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Replace durable long-form Story Director metadata using CAS revision.
 * @param request - complete director state and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
updateStoryDirector(request: UpdateFanficStoryDirectorRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one Story Director arc.
 * @param request - arc payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertStoryArc(request: UpsertFanficStoryArcRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one Story Director thread.
 * @param request - thread payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertStoryThread(request: UpsertFanficStoryThreadRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one Story Director foreshadow.
 * @param request - foreshadow payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertForeshadow(request: UpsertFanficForeshadowRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Replace the rolling Story Director horizon.
 * @param request - chapter plans and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
setStoryHorizon(request: SetFanficHorizonRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one author-only mystery truth.
 * @param request - private mystery truth and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertMysteryTruth(request: UpsertFanficMysteryTruthRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one fanfic-original invention record.
 * @param request - invention constraints and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertInvention(request: UpsertFanficInventionRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Resolve one open Story Director reconciliation issue after granular metadata has been updated.
 * @param request - branch revision and reconciliation id.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
resolveDirectorReconciliation(request: { readonly branchId: FanficBranchId; readonly expectedRevision: number; readonly reconciliationId: string }, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Compose a bounded Story Director packet around one fanfic chapter.
 * @param request - branch, chapter, and rolling horizon size.
 * @param signal - cancellation signal.
 * @returns active arcs, threads, foreshadows, horizon, and attention items.
 */
storyDirectorContext(request: StoryDirectorContextRequest, signal?: AbortSignal): Promise<StoryDirectorContext>

/**
 * Stage prose for exact-hash audit and commit operations.
 * @param request - branch, chapter, and prose text.
 * @param signal - cancellation signal.
 * @returns staged draft metadata and text.
 */
stageDraft(request: StageFanficDraftRequest, signal?: AbortSignal): Promise<FanficDraft>

/**
 * Replace one staged draft while preserving its identity.
 * @param request - draft revision and replacement prose.
 * @param signal - cancellation signal.
 * @returns updated staged draft.
 */
updateDraft(request: UpdateFanficDraftRequest, signal?: AbortSignal): Promise<FanficDraft>

/**
 * Read one staged draft.
 * @param draftId - staged draft id.
 * @param signal - cancellation signal.
 * @returns staged draft.
 */
getDraft(draftId: string, signal?: AbortSignal): Promise<FanficDraft>

/**
 * Append Observer/Reflector state using CAS revision.
 * @param request - state delta.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
applyDelta(request: ApplyFanficDeltaRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Run deterministic canon and branch-state audit.
 * @param request - draft audit request.
 * @param signal - cancellation signal.
 * @returns audit findings.
 */
audit(request: FanficAuditRequest, signal?: AbortSignal): Promise<FanficAuditResult>
```

Source: [`packages/fanfic/fanfic/src/index.ts:95`](../../packages/fanfic/fanfic/src/index.ts)
<!-- END GENERATED cordis-surface -->
