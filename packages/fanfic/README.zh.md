# Fanfic 软件包

[English](README.md) | 中文

fanfic 组是一组可选的同人创作能力。它把不可变原作 canon 与可变同人分支分开，并显式表达剧透截止点、角色知识、分歧与来源证据。

| 软件包 | 角色 | `ctx` key |
|---|---|---|
| `@deepseek-ai/dsh-fanfic` | Service Definition 与 Provider 选择 | `ctx.fanfic` |
| `@deepseek-ai/dsh-fanfic-local` | 文件系统 canon pack + 分支 Provider | — |
| `@deepseek-ai/dsh-tool-fanfic` | 直接面向模型的作者工具 Consumer 与创作策略 | — |
| `@deepseek-ai/dsh-tool-fanfic-distributed` | 分布式只读 specialist 编排 Consumer | — |

`packages/bundle/` 下的 `@deepseek-ai/dsh-fanfic-authoring` 组合四者，不修改已交付的基础 profile。

本地 stack 现支持基于 graph 的上下文扩展、人物/声音/战力/timeline/因果智能、token-bound enrichment、持久化的 chapter×记录类型 enrichment coverage ledger，以及用于 arc、thread、foreshadow 与滚动章节 horizon 的 Story Director state。因此接入的 LLM 可以逐步补全结构化 canon、管理长篇叙事承诺，同时不修改不可变来源 pack。

## v0.7 质量强制作者层

长篇 live endurance test 已把主要风险从 state correctness 推进到 quality correctness。v0.7 新增 durable Writing Contract、staged Draft Store、确定性 prose degeneration 阻断、可强制的原创 mystery reveal condition、实测 Author Context telemetry，以及 active-state-aware review exporter；v0.6 的 transaction rewrite/receipt/Director 保证继续保留。操作协议见 `FANFIC_AUTHOR_BRAIN_WORKFLOW.md`。


## v0.8 分布式 Author Brain

v0.8 让一个父级 Author Agent 保持最终权威，同时由 `fanfic_prepare_chapter` 通过只读 `ctx.subagents` specialist 分发 canon、character 与 story 分析；正文 staged 后，`fanfic_review_draft` 还可以路由独立 critic。Worker pool 可使用不同 child model/provider route，并提供有序 fallback、cooldown、有界 structured packet 与 branch/draft-sensitive cache。要真正缓解 rate limit，部署必须让 worker 使用独立 quota；specialist 永远不获得 branch mutation 或 settlement 权限。
