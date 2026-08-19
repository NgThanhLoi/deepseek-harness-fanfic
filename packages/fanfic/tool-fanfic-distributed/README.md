# `@deepseek-ai/dsh-tool-fanfic-distributed`

English | [中文](README.zh.md)

Model-facing Consumer that distributes fanfic research and critique through the existing `ctx.subagents` capability while leaving authorship and branch mutation with the parent Author Agent.

## Roles and authority

The package exposes four specialist roles: `canon`, `character`, `story`, and `critic`. `fanfic_prepare_chapter` runs any requested preparation roles (canon/character/story) concurrently up to `maxParallelSpecialists`; `fanfic_review_draft` runs the critic against one current staged draft; `fanfic_worker_status` reports the configured pool, cooldowns, provider capability availability, and cache size without starting a model.

Every child receives an enforced allow-only tool filter; providers that advertise persona support also receive an explicit read-only specialist persona. Specialists can read canon, branch-safe author context, Story Director state, staged drafts, and analysis tools appropriate to their role, but cannot call branch/Director/Mystery/Invention mutations, draft mutations, enrichment commits, `fanfic_apply_delta`, or recursive subagent controls. Their output is one bounded structured packet with `summary`, `findings`, `constraints`, `risks`, `recommendations`, `evidence`, and `gaps`. The parent Author resolves conflicts, writes prose, runs deterministic audits, and owns every commit.

## Worker pool and routing

Each configured worker has a unique name, one role, one named `ctx.subagents` provider, integer priority, and optional child `agentOptions` (`provider`, `model`, `maxTokens`). The router tries eligible workers in priority order. Retryable failure marks that worker on an exponential in-memory cooldown and falls back to the next eligible worker up to `maxAttemptsPerRole`; parent cancellation is non-retryable. Diagnostics are bounded and redact common bearer/token/key spellings before they enter parent-visible status/results.

Successful packets are cached in memory for `cacheTtlMs`. Preparation keys include branch id/revision, fanfic/canon cutoffs, POV, participants, scene goal/query, and role. Critic keys additionally bind the staged draft hash. A branch revision or draft update therefore stops matching the old cache entry automatically. `forceRefresh` bypasses a matching success cache.

The package does not pool API credentials itself. To reduce real provider rate-limit pressure, configure fallback workers whose child `agentOptions.provider` and/or `model` consume independent quotas. Several workers routed to one underlying API key still share that key's limits.

Example worker pool for the shipped bundle environment variable:

```json
[
  {"name":"canon-a","role":"canon","subagentProvider":"spawn","priority":1,"agentOptions":{"provider":"route-a","model":"fast-research","maxTokens":10000}},
  {"name":"canon-b","role":"canon","subagentProvider":"spawn","priority":2,"agentOptions":{"provider":"route-b","model":"fallback-research","maxTokens":10000}},
  {"name":"character-a","role":"character","subagentProvider":"spawn","priority":1,"agentOptions":{"provider":"route-b","model":"reasoning-medium","maxTokens":12000}},
  {"name":"story-a","role":"story","subagentProvider":"spawn","priority":1,"agentOptions":{"provider":"route-c","model":"reasoning-medium","maxTokens":12000}},
  {"name":"critic-a","role":"critic","subagentProvider":"spawn","priority":1,"agentOptions":{"provider":"route-d","model":"independent-critic","maxTokens":10000}}
]
```

`subagentProvider` selects the DSH child transport (normally `spawn` for this workflow); `agentOptions.provider` selects the child's LLM route. A configured subagent provider must advertise both `outputSchema` and `toolFilter`; an incapable or absent provider is a retryable worker failure rather than a silently degraded child.

## Configuration

| Key | Meaning |
|---|---|
| `workers` | Non-empty specialist worker pool. Each role used by a call must have at least one eligible worker. |
| `failureCooldownMs` | Base cooldown after a retryable failure; consecutive failures back off exponentially up to 8×. |
| `maxAttemptsPerRole` | Maximum eligible workers tried for one role dispatch. |
| `maxParallelSpecialists` | Maximum preparation roles executing concurrently in one `fanfic_prepare_chapter` call. |
| `cacheTtlMs` | Lifetime of successful in-memory specialist packets. `0` effectively disables reuse after the current instant. |
| `maxCacheEntries` | Maximum retained success packets; oldest insertion is evicted first. |
| `packetMaxChars` | Hard JSON-character cap for one complete structured specialist packet. Oversized output is a retryable worker failure. |
| `resultMaxChars` | Hard serialized-character cap for the complete parent-visible result of each distributed tool call, including packet wrappers and diagnostics. |

## Model Experience

### Distributed-author policy

#### What the model sees

The package contributes this stable system-prompt section while mounted:

##### Verbatim distributed policy

```markdown
Distributed fanfic authoring (API 0.8.0):
- At the parent author scope, you are the sole Author/Coordinator. If your current task explicitly identifies you as a distributed specialist child, that specialist task takes precedence: act only as a read-only advisory worker, use only visible child tools, return the required packet, and never write final prose or mutate/settle author state.
- Before a substantial chapter plan, prefer fanfic_prepare_chapter to fan out canon, character, and story analysis in parallel. Treat specialist packets as advice/evidence summaries, not authoritative branch state; resolve conflicts yourself against author_context and canon evidence.
- Specialists are read-only by enforced tool filters. If preparation returns complete=false, inspect failedRoles and retry rather than silently inventing missing canon constraints.
- After staging a meaningful draft, fanfic_review_draft may obtain an independent critic packet from another configured model/provider. Deterministic fanfic_audit, fanfic_style_audit, and anti_copy_guard remain mandatory and cannot be replaced by the critic.
- fanfic_worker_status shows the configured worker pool, provider capability availability, cooldowns, and cache state. Different worker models/providers are deployment configuration; the Author model remains the parent agent.
- Specialist success packets are cached only against state-sensitive keys (branch revision or staged-draft hash). Branch/draft changes therefore require fresh work automatically.
```

#### Token effect

Fixed prompt and three tool-schema costs are paid by the Author request. Child research consumes separate child contexts; only bounded structured packets, dispatch diagnostics, and status rows enter the Author history.

#### KV Cache effect

The Author prefix stays stable while this package's policy, tool schemas, and configuration-visible schemas are unchanged. Each specialist child has an independent request/cache history; changing a worker model/provider changes that child's cache domain, not previously reusable Author prefixes.

### Preparation and critic results

#### What the model sees

[`fanfic_prepare_chapter`](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fanfic-distributed) returns role-keyed packets plus worker/fallback/cache metadata and explicit `failedRoles`; partial preparation never fabricates a missing role. `fanfic_review_draft` returns one critic packet only for a staged draft at the current branch revision. `fanfic_worker_status` returns health/config identity without credentials or prompts.

#### Token effect

Results are bounded by `packetMaxChars` per successful role packet and retained in normal parent history until compaction. Specialist transcripts and intermediate tool calls remain in child sessions rather than being copied into the Author result.

#### KV Cache effect

Tool results append after the reusable Author prefix. Packet caching can avoid a repeated child request for the same branch/draft state but does not remove the already-retained parent result from conversation history.

## Known Limitations and Deferred Work

- **Cooldown/cache are process-local** — restart clears worker health and packet cache; no durable rate-limit scheduler is claimed.
- **Quota independence is deployment-owned** — multiple workers using the same provider credentials may hit the same RPM/TPM limit and can increase pressure instead of reducing it.
- **Specialist packets are advisory** — structured output and read-only tools bound authority, not model quality. The Author must resolve conflicts and deterministic fanfic audits remain settlement authority.
- **Provider capability requirement** — a worker transport without both `outputSchema` and `toolFilter` is unusable for this package and triggers fallback/failure.
