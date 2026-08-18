# Fanfic 软件包

[English](README.md) | 中文

fanfic 组是一组可选的同人创作能力。它把不可变原作 canon 与可变同人分支分开，并显式表达剧透截止点、角色知识、分歧与来源证据。

| 软件包 | 角色 | `ctx` key |
|---|---|---|
| `@deepseek-ai/dsh-fanfic` | Service Definition 与 Provider 选择 | `ctx.fanfic` |
| `@deepseek-ai/dsh-fanfic-local` | 文件系统 canon pack + 分支 Provider | — |
| `@deepseek-ai/dsh-tool-fanfic` | 面向模型的 Consumer 与创作策略 | — |

`packages/bundle/` 下的 `@deepseek-ai/dsh-fanfic-authoring` 组合三者，不修改已交付的基础 profile。

本地 stack 现支持基于 graph 的上下文扩展、人物/声音/战力/timeline/因果智能、token-bound enrichment、持久化的 chapter×记录类型 enrichment coverage ledger，以及用于 arc、thread、foreshadow 与滚动章节 horizon 的 Story Director state。因此接入的 LLM 可以逐步补全结构化 canon、管理长篇叙事承诺，同时不修改不可变来源 pack。

## v0.6 事务化作者层

真实多章节测试把关键正确性约束从 prompt 约定推进到 runtime transaction。最终稿 audit receipt 会 gate 章节持久化；重写显式选择继承或替换 chapter-owned state；稳定 branch name 消除 UUID 抄写风险；rewrite reconciliation 防止 Story Director 元数据静默过期；author-context 增长也受 deployment hard budget 限制。运行协议见 `FANFIC_AUTHOR_BRAIN_WORKFLOW.md`。
