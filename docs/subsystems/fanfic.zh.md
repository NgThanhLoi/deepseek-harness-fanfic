# 同人写作（Fanfic Authoring）

[English](fanfic.md) | 中文

`ctx.fanfic`（[`@deepseek-ai/dsh-fanfic`](../../packages/fanfic/fanfic)）是选择启用的同人写作 seam：不可变的原作正典加上可变的作者分支，提供防剧透查询、可验证的结构化补全与事务化章节结算。它只能通过 [fanfic-authoring bundle patch](../../packages/bundle/fanfic-authoring) 加载，绝不会出现在基础组合中。

[包 README](../../packages/fanfic/fanfic/README.md) 负责组合与服务配置，[`@deepseek-ai/dsh-fanfic-local`](../../packages/fanfic/fanfic-local/README.md) 负责基于随附 [《一世之尊》正典包](../../canon-packs/yishizhizun) 的仓库内提供方，36 个面向模型的工具收录在[工具 Schema 目录](../tool-catalog.md#deepseek-aidsh-tool-fanfic)。下面由生成器产出的 Cordis API 记录面向提供方的分派服务契约，是每个操作的方法级权威。

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

`fanfic_audit`、`fanfic_style_audit` 与 `anti_copy_guard` 各自为确切的草稿返回确定性收据，`fanfic_apply_delta`（或一次重写）要求该草稿与分支修订版本三张收据全部通过。重写选择 `inherit`（继承上一份活跃的结构化章节状态）或 `replace`（丢弃该状态，若状态会丢失则要求显式确认）；把后一章的状态反向补进前章会被拒绝。重写之后的元数据编辑通过 `story_reconciliation_resolve` 显式对账。

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
search( request: CanonSearchRequest, signal?: AbortSignal, ): Promise<readonly CanonSearchHit[]>

/**
 * Read one source chapter under a spoiler cutoff.
 * @param request - chapter read request.
 * @param signal - cancellation signal.
 * @returns source chapter.
 */
readChapter( request: CanonChapterReadRequest, signal?: AbortSignal, ): Promise<CanonChapter>

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
authorContext( request: AuthorContextRequest, signal?: AbortSignal, ): Promise<AuthorContext>

/**
 * Query source-backed causal links.
 * @param request - causal query.
 * @param signal - cancellation signal.
 * @returns bounded causal trace.
 */
traceCausality( request: CanonCausalityTraceRequest, signal?: AbortSignal, ): Promise<CanonCausalityTrace>

/**
 * Query worldline/timeline rules, relevant events, and source evidence at one cutoff.
 * @param request - timeline/worldline query.
 * @param signal - cancellation signal.
 * @returns bounded timeline context.
 */
timelineContext( request: CanonTimelineContextRequest, signal?: AbortSignal, ): Promise<CanonTimelineContext>

/**
 * Expand explicit scene entities through spoiler-safe structured graph edges.
 * @param request - seed entities and cutoff.
 * @param signal - cancellation signal.
 * @returns discovered related entities with reasons.
 */
expandContext( request: CanonContextExpansionRequest, signal?: AbortSignal, ): Promise<CanonContextExpansion>

/**
 * Build one source-backed character dossier at the requested cutoff.
 * @param request - character dossier request.
 * @param signal - cancellation signal.
 * @returns temporal state, epistemics, relationships, powers, evidence, and gaps.
 */
characterIntelligence( request: CharacterIntelligenceRequest, signal?: AbortSignal, ): Promise<CharacterIntelligence>

/**
 * Return bounded source-backed dialogue/voice evidence for one character.
 * @param request - character, cutoff, and sample limit.
 * @param signal - cancellation signal.
 * @returns contextual source windows and structured voice notes.
 */
characterVoiceContext( request: CharacterVoiceContextRequest, signal?: AbortSignal, ): Promise<CharacterVoiceContext>

/**
 * Compose cutoff-safe work-level narrative rhythm and scene-mode evidence.
 * @param request - scene mode, cutoff, participants, and sample limit.
 * @param signal - cancellation signal.
 * @returns high-level narrative style context.
 */
narrativeStyleContext( request: NarrativeStyleContextRequest, signal?: AbortSignal, ): Promise<NarrativeStyleContext>

/**
 * Detect exact draft overlap against immutable source text without exposing future-source locations.
 * @param request - draft, cutoff, and overlap thresholds.
 * @param signal - cancellation signal.
 * @returns corpus-wide anti-copy findings.
 */
antiCopyGuard( request: AntiCopyGuardRequest, signal?: AbortSignal, ): Promise<AntiCopyGuardResult>

/**
 * Audit high-level narrative drift and accidental source overlap.
 * @param request - draft plus style-context and anti-copy settings.
 * @param signal - cancellation signal.
 * @returns quantitative style and anti-copy findings.
 */
auditNarrativeStyle( request: NarrativeStyleAuditRequest, signal?: AbortSignal, ): Promise<NarrativeStyleAuditResult>

/**
 * Assess known power constraints without inventing a fight winner.
 * @param request - actors, scenario, and cutoff.
 * @param signal - cancellation signal.
 * @returns evidence-first capability assessment.
 */
assessPower( request: PowerAssessmentRequest, signal?: AbortSignal, ): Promise<PowerAssessment>

/**
 * Scan canon dependencies and branch threads affected by a proposed divergence.
 * @param request - proposed change, entities, and cutoff.
 * @param signal - cancellation signal.
 * @returns relevant dependencies and open branch threads.
 */
impactScan( request: FanficImpactScanRequest, signal?: AbortSignal, ): Promise<FanficImpactScan>

/**
 * Validate a structured enrichment candidate against immutable chapter evidence.
 * @param candidate - source-backed candidate to validate.
 * @param signal - cancellation signal.
 * @returns evidence result and token when valid.
 */
validateEnrichment( candidate: CanonEnrichmentCandidate, signal?: AbortSignal, ): Promise<CanonEnrichmentValidation>

/**
 * Commit a token-bound verified enrichment record into the provider overlay.
 * @param request - candidate plus validation token.
 * @param signal - cancellation signal.
 * @returns committed record metadata.
 */
commitEnrichment( request: CanonEnrichmentCommitRequest, signal?: AbortSignal, ): Promise<CanonEnrichmentCommitResult>

/**
 * Plan the next source chapters requiring structured enrichment review.
 * @param request - chapter range, record families, and batch size.
 * @param signal - cancellation signal.
 * @returns deterministic enrichment work queue.
 */
planEnrichment( request: CanonEnrichmentPlanRequest, signal?: AbortSignal, ): Promise<CanonEnrichmentPlan>

/**
 * Report persisted enrichment coverage over a chapter range.
 * @param request - chapter range and record families.
 * @param signal - cancellation signal.
 * @returns aggregate coverage and effective checkpoints.
 */
enrichmentProgress( request: CanonEnrichmentProgressRequest, signal?: AbortSignal, ): Promise<CanonEnrichmentProgress>

/**
 * Mark one chapter/record-family review complete after verified records have been admitted.
 * @param request - reviewed chapter, family, admitted ids, and review notes.
 * @param signal - cancellation signal.
 * @returns persisted coverage checkpoint.
 */
checkpointEnrichment( request: CanonEnrichmentCheckpointRequest, signal?: AbortSignal, ): Promise<CanonEnrichmentCoverage>

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
createBranch( request: CreateFanficBranchRequest, signal?: AbortSignal, ): Promise<FanficBranch>

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
recordDivergence( request: RecordFanficDivergenceRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Replace branch author intent using CAS revision.
 * @param request - intent update.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
updateIntent( request: UpdateFanficIntentRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Replace durable long-form Story Director metadata using CAS revision.
 * @param request - complete director state and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
updateStoryDirector( request: UpdateFanficStoryDirectorRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Upsert one Story Director arc.
 * @param request - arc payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertStoryArc( request: UpsertFanficStoryArcRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Upsert one Story Director thread.
 * @param request - thread payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertStoryThread( request: UpsertFanficStoryThreadRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Upsert one Story Director foreshadow.
 * @param request - foreshadow payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertForeshadow( request: UpsertFanficForeshadowRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Replace the rolling Story Director horizon.
 * @param request - chapter plans and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
setStoryHorizon( request: SetFanficHorizonRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Upsert one author-only mystery truth.
 * @param request - private mystery truth and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertMysteryTruth( request: UpsertFanficMysteryTruthRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Upsert one fanfic-original invention record.
 * @param request - invention constraints and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertInvention( request: UpsertFanficInventionRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Resolve one open Story Director reconciliation issue after granular metadata has been updated.
 * @param request - branch revision and reconciliation id.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
resolveDirectorReconciliation( request: { readonly branchId: FanficBranchId readonly expectedRevision: number readonly reconciliationId: string }, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Compose a bounded Story Director packet around one fanfic chapter.
 * @param request - branch, chapter, and rolling horizon size.
 * @param signal - cancellation signal.
 * @returns active arcs, threads, foreshadows, horizon, and attention items.
 */
storyDirectorContext( request: StoryDirectorContextRequest, signal?: AbortSignal, ): Promise<StoryDirectorContext>

/**
 * Append Observer/Reflector state using CAS revision.
 * @param request - state delta.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
applyDelta( request: ApplyFanficDeltaRequest, signal?: AbortSignal, ): Promise<FanficBranch>

/**
 * Run deterministic canon and branch-state audit.
 * @param request - draft audit request.
 * @param signal - cancellation signal.
 * @returns audit findings.
 */
audit(request: FanficAuditRequest, signal?: AbortSignal): Promise<FanficAuditResult>
```

Source: [`packages/fanfic/fanfic/src/index.ts:91`](../../packages/fanfic/fanfic/src/index.ts)
<!-- END GENERATED cordis-surface -->