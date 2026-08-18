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

## v0.6 transactional author layer

Live multi-chapter testing moved correctness enforcement from prompt convention into runtime transactions. Exact-draft audit receipts gate chapter persistence; rewrites explicitly inherit or replace chapter-owned state; branch names remove UUID transcription hazards; rewrite reconciliation keeps Story Director metadata from silently going stale; and author-context growth is bounded by a hard deployment budget. See `FANFIC_AUTHOR_BRAIN_WORKFLOW.md` for the operating protocol.
