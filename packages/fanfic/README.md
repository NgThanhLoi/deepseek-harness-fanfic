# Fanfic packages

English | [中文](README.zh.md)

The fanfic group is an opt-in authoring capability family. It keeps immutable source canon separate from mutable fanfic branches and makes spoiler cutoffs, character knowledge, divergence, provenance, verified enrichment, and author-facing intelligence explicit.

| Package | Role | `ctx` key |
|---|---|---|
| `@deepseek-ai/dsh-fanfic` | Service Definition and provider selection | `ctx.fanfic` |
| `@deepseek-ai/dsh-fanfic-local` | Filesystem canon-pack + branch Provider | — |
| `@deepseek-ai/dsh-tool-fanfic` | Model-facing Consumer and workflow policy | — |

`@deepseek-ai/dsh-fanfic-authoring` in `packages/bundle/` composes all three without modifying shipped base profiles.

The local stack now supports graph-based context expansion, character/voice/power/timeline/causality intelligence, token-bound enrichment, a persistent chapter×record-family enrichment coverage ledger, and durable Story Director state for arcs, threads, foreshadows, and a rolling chapter horizon. A connected LLM can therefore improve structured canon incrementally and manage long-form narrative promises without modifying the immutable source pack.

## v0.7 quality-enforced author layer

Live endurance testing moved the next failure class from state correctness into quality correctness. v0.7 adds a durable Writing Contract, a staged Draft Store, deterministic prose-degeneration blocking, enforceable original-mystery reveal conditions, measured Author Context telemetry, and an active-state-aware review exporter. The v0.6 transactional rewrite/receipt/Director guarantees remain in place. See `FANFIC_AUTHOR_BRAIN_WORKFLOW.md` for the operating protocol.
