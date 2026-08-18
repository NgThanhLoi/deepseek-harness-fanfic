# `@deepseek-ai/dsh-fanfic-authoring`

English | [中文](README.zh.md)

Opt-in bundle that mounts `@deepseek-ai/dsh-fanfic`, the local provider, and the model-facing fanfic tools. It is not part of the shipped base profile and does not patch the agent loop.

By default it reads `./canon-packs/yishizhizun` and writes `./.dsh-fanfic-state`. The state root holds verified canon-enrichment rows, enrichment coverage checkpoints, and durable fanfic branches including Story Director metadata. Override the paths with `DSH_FANFIC_CANON_PACK` and `DSH_FANFIC_STATE_DIR`. Model selection remains ordinary DeepSeek Harness configuration, so the bundle is not tied to a DeepSeek model.

## Model Experience

Indirectly, through the inserted `@deepseek-ai/dsh-tool-fanfic` row, which owns the fixed authoring policy, tool schemas, and rendered tool results.

#### KV Cache effect

Prefix-stable while the mounted plugin composition and configs remain unchanged.

## Known Limitations and Deferred Work

- **Opt-in only** — the bundle intentionally does not alter `dsh-base`, `web`, or `headless` defaults; add this patch to the profile used for fanfic work.
- **Local storage default** — the shipped composition uses the filesystem provider. The Service Definition intentionally permits a later SQLite, vector, or remote provider without changing the model-facing tools.

## Tuning

`cordis.patch.yml` explicitly declares the Provider and Consumer deployment limits, including author-context expansion/evidence, voice samples, Style Bank reference/excerpt limits, anti-copy thresholds/caps, enrichment batches, and Story Director horizon. Copy or override that patch to tune a deployment without editing fanfic package source.

## v0.6 live-run preflight

After building Harness and before attaching a live model, run `node scripts/fanfic/verify_runtime_bundle.mjs`. The preflight requires tool API `0.6.0` and checks that every source-declared fanfic tool name exists in the built tool artifact, preventing a source-new/runtime-stale test run. A live authoring session should call `fanfic_status` first and require tool API `0.6.0`, branch format `2`, and author-context version `3` before writing.
