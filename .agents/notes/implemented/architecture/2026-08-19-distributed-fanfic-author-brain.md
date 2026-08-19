# Agent Note: Fanfic authorship stays centralized while specialist analysis is distributed

Status: implemented

English | [中文](2026-08-19-distributed-fanfic-author-brain.zh.md)

## Problem

The quality-enforced fanfic workflow made one strong Author model responsible for both creative decisions and a large amount of repetitive evidence work: canon searches, character/voice checks, Story Director review, and post-draft critique. Long live runs showed that this workload can exhaust one model/provider quota even when branch correctness and audit transactions are healthy. Simply rotating the chapter writer across models would reduce quota pressure at the cost of prose voice, character interpretation, and implicit author-decision continuity.

DeepSeek Harness already owns a multi-provider subagent seam. A fanfic-specific scheduler should therefore reuse `ctx.subagents` rather than create another agent runtime or patch the agent loop, while preserving the v0.7 rule that only the parent Author can mutate branch/Director state or settle prose.

## Decision

`@deepseek-ai/dsh-tool-fanfic-distributed` is an opt-in Consumer beside the 39 direct fanfic tools. The parent model remains the Author/Coordinator and receives three additional tools: `fanfic_prepare_chapter`, `fanfic_review_draft`, and `fanfic_worker_status`.

Preparation dispatches `canon`, `character`, and `story` specialist roles through configured named subagent providers. Draft review dispatches a `critic` role against an exact current staged draft. Each worker can override the child LLM provider/model/token budget independently, so deployments may place specialist work on different rate-limit quotas without changing authoring code. The default bundle uses `spawn` workers that inherit the Author model; that default proves composition and parallel role isolation but does not claim quota distribution.

Specialists receive one enforced allow-only global-tool list. Their role scopes contain read-only canon/author-context/Director/draft analysis operations and exclude every branch, Story Director, Mystery Truth, Invention, draft mutation, enrichment commit, chapter settlement, and subagent-control operation. The child must also return one object-rooted structured packet (`summary`, `findings`, `constraints`, `risks`, `recommendations`, `evidence`, `gaps`). A subagent provider without both `outputSchema` and `toolFilter` support cannot serve a worker and fails into ordinary fallback.

The local router tries workers by role priority. Retryable failures place that worker on exponential process-local cooldown and continue to another eligible worker up to the configured attempt cap. Parent cancellation is non-retryable. Successful packets are bounded as complete serialized values and cached by state-sensitive keys: branch revision for planning and branch revision plus staged-draft hash for critique. A branch mutation or draft update therefore stops matching old specialist work without maintaining a second invalidation graph. Diagnostics are bounded and redact common credential spellings before parent exposure.

Preparation roles run concurrently up to the configured specialist limit. Partial failure is explicit (`complete=false`, `failedRoles`) and never substitutes invented evidence. Specialist packets remain advisory: the Author resolves disagreements against `author_context`/canon evidence, owns the final plan and prose, and still must pass deterministic canon/style/copy audits before `fanfic_apply_delta`.

## Alternatives considered

**Rotate the chapter writer between several models.** Rejected because prose style, implicit characterization, and author-level continuity become model-dependent. Worker models may vary; the canonical Writer does not.

**Let the Author invoke generic `subagent` tools manually.** Rejected as the primary workflow because delegation prompts, tool scopes, fallback handling, and repeated rate-limit failures would still consume Author reasoning/tool-call budget and permit inconsistent specialist contracts.

**Add a new fanfic worker service seam.** Rejected because DSH already provides named subagent registration, execution, cancellation, model overrides, structured output, and tool filtering. The fanfic package owns only orchestration policy over those existing services.

**Persist cooldown and specialist packets in branch state.** Rejected for this revision. Worker health is deployment/process state, not story truth, and branch/draft-sensitive packet caches are disposable acceleration. Restarting safely recomputes them.

## Verification

Focused TypeScript builds cover the direct fanfic packages and the new distributed Consumer. `scripts/fanfic/distributed_router_smoke.mjs` exercises retryable fallback/cooldown, state-sensitive cache reuse and invalidation, non-retryable cancellation, complete-packet size rejection, credential redaction, and a source guard that keeps mutation/subagent-control tools out of specialist allow lists. `scripts/fanfic/verify_runtime_bundle.mjs` now requires both the direct API and distributed API at `0.8.0` and verifies all 42 built fanfic-facing tool names before a live model run.

The existing provider/long-form/review-export smokes remain the authority for canon/branch transaction behavior. A real multi-provider live test is still required to measure quota relief and specialist quality because a keyless sandbox cannot manufacture independent provider rate limits.

## Consequences

The Author model now spends its scarce quota primarily on synthesis, final planning, prose, revision, and authoritative mutations. Canon/character/story research and independent critique can be distributed across separate child models/providers and run in parallel. This is distributed thinking with centralized authorship, not multi-writer consensus.

Rate-limit relief is not automatic. Multiple workers routed to the same credential still share its RPM/TPM budget and may increase pressure. Deployment must configure genuinely independent child routes where that isolation matters. Cooldown/cache state is intentionally process-local, and specialist output remains advisory rather than a new source of branch truth.
