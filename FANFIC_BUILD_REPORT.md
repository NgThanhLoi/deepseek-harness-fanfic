# Fanfic capability build report — v0.8 Distributed Author Brain

Source lineage: the user-provided repository ZIP at Git `master` commit `9abe161600fd171a84e47c9830cade5ba6753f8f`, itself carrying the v0.7 quality-enforced fanfic capability. The original fanfic fork base remains `47f943859bef60e4160492346772ded9b24f765a`.

## Why v0.8 exists

The v0.7 Author Brain could enforce canon/state/prose quality, but one strong Author model still performed research, character analysis, Story Director reasoning, prose, and review. That concentrates input/tool workload on one provider quota and makes a long run vulnerable to RPM/TPM limits. v0.8 distributes **advisory analysis**, not authorship: one parent Author/Coordinator remains the sole writer and mutation authority while read-only specialist child agents can run on independent models/providers.

## Architecture

`@deepseek-ai/dsh-tool-fanfic-distributed` is a new Consumer of the existing `ctx.fanfic`, `ctx.subagents`, `ctx.tools`, and `ctx.systemPrompt` seams. It does not patch the agent loop and does not introduce a new service seam.

```text
                        AUTHOR / COORDINATOR
                         strong writer model
                                 |
                  fanfic_prepare_chapter
                                 |
            +--------------------+--------------------+
            |                    |                    |
      Canon specialist    Character specialist    Story specialist
       read-only child      read-only child        read-only child
            |                    |                    |
            +---------- bounded structured packets--+
                                 |
                         Author synthesizes
                                 |
                         writes/stages draft
                                 |
                       fanfic_review_draft
                                 |
                         Critic specialist
                           read-only child
                                 |
                  deterministic v0.7 audits
                                 |
                         Author-only commit
```

### Centralized authority

Specialists can advise but cannot settle the story. Their child scopes are allow-only and exclude `fanfic_apply_delta`, branch/intent/divergence mutation, Draft Store mutation, Story Director mutation, Mystery/Invention mutation, enrichment commits/checkpoints, and subagent-control recursion. The existing exact-draft receipt gate remains the only commit path.

### Specialist roles

- **canon** — cutoff-safe canon research, timeline, power, causality, context expansion and impact analysis;
- **character** — character intelligence/voice, epistemics, plausible choices, relationship and capability constraints;
- **story** — Story Director priorities, causal consequences, due threads/foreshadows, and candidate scene progressions;
- **critic** — independent read-only review of a staged draft for continuity, character logic, unsupported capability, over-reveal, voice/rhythm and obvious degeneration.

Every child must return the same bounded structured packet vocabulary: `summary`, `findings`, `constraints`, `risks`, `recommendations`, `evidence`, and `gaps`. Child providers must advertise both `outputSchema` and `toolFilter`; otherwise that worker fails loud and routing moves to a fallback.

## Model-facing additions

v0.8 adds three orchestration tools while preserving the 39 direct authoring tools:

- `fanfic_prepare_chapter` — resolves the branch, binds work to the current branch revision, dispatches selected canon/character/story roles in parallel, and returns bounded specialist packets plus fallback diagnostics;
- `fanfic_review_draft` — binds critique to the current staged `draftId`/`draftHash` and branch revision, then routes an independent critic specialist;
- `fanfic_worker_status` — reports worker/provider availability, required capability support, cooldown/failure state, in-flight work and packet-cache size without running a model.

Total model-facing fanfic tools: **42** (`39 direct + 3 distributed`). Direct and distributed tool APIs are both `0.8.0`; branch format remains `3` and Author Context remains version `4`.

## Work routing and rate-limit behavior

Workers are configured by role with a named subagent provider, priority and optional child `agentOptions.provider/model/maxTokens`. The router:

- tries workers in deterministic priority order;
- falls back after retryable failures (including provider rate-limit failures surfaced by the child run);
- puts failed workers on exponential in-memory cooldown;
- does not retry parent cancellation;
- caps attempts per role;
- limits preparation role concurrency;
- bounds every specialist packet and the complete parent-visible result;
- redacts common bearer/token/key/secret spellings from exposed diagnostics;
- caches successful preparation packets by branch revision + scene request and critic packets by branch revision + staged draft hash.

The bundle accepts `DSH_FANFIC_WORKERS_JSON`. The default pool uses `spawn` workers that inherit the Author model; that validates role isolation/parallelism but **does not reduce a shared provider quota**. Actual rate-limit relief requires configuring workers against model/provider quotas that are independent of the Author route.

## Prompt precedence

A distributed child still inherits global system-prompt contributions in normal Harness composition. Both direct and distributed fanfic policies therefore contain an explicit specialist-child exception: when the child task identifies itself as a read-only distributed specialist, that role takes precedence over the Author settlement workflow. Enforcement does not rely on prose alone: the child tool filter is the executable authority boundary.

## Verification actually run

Against the final v0.8 source:

- Focused TypeScript 5.8.3 build passed for `dsh-fanfic`, `dsh-fanfic-local`, `dsh-tool-fanfic`, and the new `dsh-tool-fanfic-distributed` package.
- `node scripts/fanfic/distributed_router_smoke.mjs` passed retryable fallback/cooldown, state-sensitive cache invalidation, non-retryable cancellation, packet-size rejection, read-only specialist allow-list checks, the direct-policy specialist exception, and diagnostic credential redaction.
- `node scripts/fanfic/provider_smoke.mjs` passed against all **1,409** derived 《一世之尊》 chapters.
- `node scripts/fanfic/longform_regression_smoke.mjs` passed the v0.7 transactional/quality suite: durable 2,500-Han minimum, staged-draft receipt invalidation, five degeneration signals, rewrite inherit/replace protection, backfill rejection, Mystery Reveal Guard, audit precision, and Author Context v4 hard-budget telemetry (`17,860 / 20,000` serialized characters in the compaction fixture).
- `node scripts/fanfic/review_export_smoke.mjs` passed.
- Fanfic Cordis patch/source schema parity passed exactly: **26** local-provider keys, **11** direct-tool keys, **8** distributed-tool keys.
- `check-workspace-constraints` passed.
- `verify-package-invariants`: **224** hand-owned package companions conform.
- `verify-dsh-package-licenses`: **227** DSH packages checked; all MIT.
- Agent Note format/classification: **552** notes passed both gates.
- `verify-export-jsdoc` reports **zero fanfic violations** and only the same eight pre-existing upstream violations in `packages/subagent/subagent-claude-code/src/process.ts`.
- `git diff --check` passed.

A real Loader-composition test fixture is included at `examples/acp-agent/tests/fixtures/fanfic/distributed/` and asserts the three public schemas plus central-Author/read-only-specialist policy without starting a child. It could not be executed in this sandbox because the supplied source archive does not include the complete upstream runtime dependency/bundle install required by `dsh-app-boot` (for example `esbuild`, `chokidar`, and the full `zod` runtime).

## Blocked / not claimed

A repository-wide `pnpm install`, production `pnpm run build`, full Vitest suite, and production Loader smoke are not claimed. This sandbox has Node `22.16.0`, while the repository requires `^22.19 || >=24`, and the source ZIP has only a partial dependency surface. `verify-cordis-config.ts` is blocked by the incomplete `js-yaml` install; the README model-experience/limitations gates are blocked by missing `mdast-util-from-markdown`. The fanfic Cordis schema was therefore checked independently as described above.

The release intentionally excludes temporary tsc/runtime shims. On a normal Node 24 checkout, run the production build before `scripts/fanfic/verify_runtime_bundle.mjs`.

## Recommended live test

Use one stable Author/Writer model for prose and configure at least two independent quota routes for specialists. A useful first v0.8 live test is 5–10 chapters while recording per-role worker selection/fallback, parent-Author token/tool-call load, 429/cooldown behavior, packet cache hits, prose quality, and exact branch/draft correctness. Compare that run with the previous single-model baseline; the success criterion is lower Author-provider workload without any loss of canon/character/transaction correctness.
