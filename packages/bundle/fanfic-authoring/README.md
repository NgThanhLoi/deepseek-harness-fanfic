# `@deepseek-ai/dsh-fanfic-authoring`

English | [中文](README.zh.md)

Opt-in bundle that mounts `@deepseek-ai/dsh-fanfic`, the local provider, the direct authoring tools, and the distributed specialist Consumer. It is not part of the shipped base profile and does not patch the agent loop.

By default it reads `./canon-packs/yishizhizun` and writes `./.dsh-fanfic-state`. The state root holds verified canon-enrichment rows, enrichment coverage checkpoints, and durable fanfic branches including Story Director metadata. Override the paths with `DSH_FANFIC_CANON_PACK` and `DSH_FANFIC_STATE_DIR`. Model selection remains ordinary DeepSeek Harness configuration, so the bundle is not tied to a DeepSeek model.

## Tuning

`cordis.patch.yml` explicitly declares the Provider and Consumer deployment limits, including author-context expansion/evidence, voice samples, Style Bank reference/excerpt limits, anti-copy thresholds/caps, prose-quality thresholds, Author Context hard budget, enrichment batches, and Story Director horizon. Copy or override that patch to tune a deployment without editing fanfic package source.

## v0.8 distributed live-run preflight

After building Harness and before attaching a live model, run `node scripts/fanfic/verify_runtime_bundle.mjs`. The preflight requires tool API `0.8.0` and checks every source-declared fanfic tool against the built artifact. A live authoring session must call `fanfic_status` first and require tool API `0.8.0`, branch format `3`, and author-context version `4`.


The patch also mounts `@deepseek-ai/dsh-tool-fanfic-distributed`. `DSH_FANFIC_WORKERS_JSON` accepts the complete specialist worker pool. Without it, canon/character/story/critic workers use the in-process `spawn` transport and inherit the Author model; this preserves role isolation and parallelism but does **not** distribute provider quota. For rate-limit relief, configure worker `agentOptions.provider`/`model` values backed by independent quotas. `fanfic_worker_status` should show every required worker provider available before a long run.

Use a fresh state directory for clean endurance tests. Existing v0.7 branch-format-v3 state remains format-compatible; older on-disk branch formats are rejected. The default Writing Contract is Chinese prose at 2500–4000 Han characters. For review export, use `scripts/fanfic/export_live_review.mjs` after the run; redact any optional session/context directories before passing them to the exporter.

## Model Experience

Indirectly, through the inserted `@deepseek-ai/dsh-tool-fanfic` and `@deepseek-ai/dsh-tool-fanfic-distributed` rows, which own the direct authoring and specialist-orchestration model surfaces.

#### KV Cache effect

Prefix-stable while the mounted plugin composition and configs remain unchanged.

## Known Limitations and Deferred Work

- **Opt-in only** — the bundle intentionally does not alter `dsh-base`, `web`, or `headless` defaults; add this patch to the profile used for fanfic work.
- **Local storage default** — the shipped composition uses the filesystem provider. The Service Definition intentionally permits a later SQLite, vector, or remote provider without changing the model-facing tools.
