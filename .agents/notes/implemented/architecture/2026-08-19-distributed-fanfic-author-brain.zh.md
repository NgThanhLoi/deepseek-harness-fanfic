# Agent Note: 同人作者权保持集中，specialist 分析进行分布式执行

Status: implemented

[English](2026-08-19-distributed-fanfic-author-brain.md) | 中文

## 问题

质量强制后的 fanfic 工作流仍让一个强 Author model 同时承担创作决策与大量重复证据工作：canon 检索、人物/voice 检查、Story Director review，以及 draft 后的 critique。真实长篇运行表明，即使 branch correctness 与 audit transaction 已稳定，这些工作量仍可能耗尽单个 model/provider quota。简单地让多个模型轮流写章节虽然能分摊 quota，却会牺牲 prose voice、人物解释和隐含作者决策的一致性。

DeepSeek Harness 已经拥有多 provider subagent seam。因此 fanfic 不应再造 agent runtime 或 patch agent loop，而应复用 `ctx.subagents`，同时继续保持 v0.7 的权威规则：只有父级 Author 可以修改 branch/Director state 或 settle prose。

## 决策

`@deepseek-ai/dsh-tool-fanfic-distributed` 作为 39 个直接 fanfic tools 旁边的 opt-in Consumer。父级模型保持 Author/Coordinator 身份，并新增三个工具：`fanfic_prepare_chapter`、`fanfic_review_draft`、`fanfic_worker_status`。

Preparation 通过配置的命名 subagent provider 分发 `canon`、`character`、`story` specialist；draft review 针对当前精确 staged draft 分发 `critic`。每个 worker 都可独立覆盖 child LLM provider/model/token budget，因此部署可以把 specialist 工作放到不同 rate-limit quota，而无需修改 authoring code。bundle 默认使用继承 Author model 的 `spawn` worker；这个默认值证明组合与并行角色隔离，但不宣称能够分散 quota。

Specialist 获得强制 allow-only global-tool list。各角色只包含只读 canon/author-context/Director/draft 分析操作，并排除所有 branch、Story Director、Mystery Truth、Invention、draft mutation、enrichment commit、chapter settlement 与 subagent-control 操作。Child 还必须返回统一 object-rooted structured packet（`summary`、`findings`、`constraints`、`risks`、`recommendations`、`evidence`、`gaps`）。如果 subagent provider 不同时支持 `outputSchema` 和 `toolFilter`，该 worker 不可用并进入正常 fallback。

本地 router 按 role priority 尝试 worker。可重试失败会使该 worker 进入指数增长的进程内 cooldown，然后在配置的 attempt 上限内继续下一个可用 worker；父级取消不可重试。成功 packet 以完整序列化值执行上限，并使用 state-sensitive key 缓存：planning 绑定 branch revision，critique 绑定 branch revision 与 staged-draft hash。这样 branch mutation 或 draft update 会自然停止匹配旧 specialist 工作，无需维护第二套 invalidation graph。诊断在父级可见前会限制长度并遮蔽常见 credential 写法。

Preparation role 会在配置的 specialist 并行上限内并发执行。Partial failure 显式返回 `complete=false` 与 `failedRoles`，绝不以模型猜测补足缺失 evidence。Specialist packet 始终只是建议：Author 必须依据 `author_context`/canon evidence 解决冲突，负责最终 plan 与 prose，并继续通过确定性 canon/style/copy audits 后才能 `fanfic_apply_delta`。

## 考虑过的替代方案

**让多个模型轮流担任章节 Writer。** 拒绝，因为 prose style、隐含人物理解与作者层 continuity 会变成 model-dependent。Worker model 可以变化，但 canonical Writer 不变化。

**让 Author 手动调用通用 `subagent` tools。** 不作为主要工作流，因为 delegation prompt、tool scope、fallback 与反复 rate-limit failure 仍会消耗 Author reasoning/tool-call budget，也会让 specialist contract 不一致。

**新增 fanfic worker service seam。** 拒绝，因为 DSH 已经提供命名 subagent 注册、执行、取消、model override、structured output 与 tool filtering。fanfic 只需要在现有服务之上拥有编排策略。

**把 cooldown 与 specialist packet 持久化进 branch state。** 本版拒绝。Worker health 属于 deployment/process state，不是故事真相；按 branch/draft state 绑定的 packet cache 只是可丢弃加速。重启后安全重算即可。

## 验证

Focused TypeScript build 覆盖直接 fanfic packages 与新的 distributed Consumer。`scripts/fanfic/distributed_router_smoke.mjs` 覆盖可重试 fallback/cooldown、state-sensitive cache 复用与失效、不可重试取消、完整 packet size rejection、credential redaction，以及确保 mutation/subagent-control tools 不进入 specialist allow list 的源码 guard。`scripts/fanfic/verify_runtime_bundle.mjs` 现在同时要求 direct API 与 distributed API 为 `0.8.0`，并在 live model 前核对全部 42 个 built fanfic-facing tool 名称。

既有 provider/long-form/review-export smoke 继续负责 canon/branch transaction 行为。真实 multi-provider live test 仍必须用于测量 quota 缓解与 specialist 质量，因为无 key sandbox 无法制造独立 provider rate limit。

## 后果

Author model 的稀缺 quota 现在主要用于 synthesis、final planning、prose、revision 与权威 mutation。Canon/character/story research 和 independent critique 可以分发到不同 child model/provider 并行执行。这是 distributed thinking with centralized authorship，而不是 multi-writer consensus。

Rate-limit 缓解不会自动发生。多个 worker 如果仍走同一个 credential，就继续共享 RPM/TPM budget，甚至可能增加压力。需要隔离时，deployment 必须配置真正独立的 child route。Cooldown/cache state 有意只在进程内保存，specialist output 也仍是 advisory，不会成为新的 branch truth 来源。
