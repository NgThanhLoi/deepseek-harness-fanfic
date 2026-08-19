# `@deepseek-ai/dsh-tool-fanfic-distributed`

[English](README.md) | 中文

面向模型的 Consumer，通过现有 `ctx.subagents` 能力分发同人研究与审稿工作，同时把作者身份与分支写权限保留给父级 Author Agent。

## 角色与权限

包提供四种 specialist 角色：`canon`、`character`、`story`、`critic`。`fanfic_prepare_chapter` 按 `maxParallelSpecialists` 并行运行请求的准备角色（canon/character/story）；`fanfic_review_draft` 针对一个当前 staged draft 运行 critic；`fanfic_worker_status` 只报告 worker pool、cooldown、provider capability 可用性与 cache 大小，不启动模型。

每个 child 都获得强制 allow-only 工具过滤；支持 persona 的 provider 还会收到显式只读 specialist persona。Specialist 可以读取与角色相符的 canon、安全 branch author context、Story Director、staged draft 与分析工具，但不能调用 branch/Director/Mystery/Invention mutation、draft mutation、enrichment commit、`fanfic_apply_delta` 或递归 subagent 控制。输出统一为有界 structured packet：`summary`、`findings`、`constraints`、`risks`、`recommendations`、`evidence`、`gaps`。父级 Author 负责解决冲突、写 prose、运行确定性 audit，并拥有全部 commit 权限。

## Worker pool 与路由

每个 worker 有唯一名称、一个角色、一个命名的 `ctx.subagents` provider、整数 priority，以及可选 child `agentOptions`（`provider`、`model`、`maxTokens`）。Router 按 priority 尝试可用 worker。可重试失败会让该 worker 进入指数增长的进程内 cooldown，并在 `maxAttemptsPerRole` 内回退到下一个可用 worker；父级取消不可重试。诊断在进入父级可见 status/result 之前会限制长度并遮蔽常见 bearer/token/key 写法。

成功 packet 按 `cacheTtlMs` 在内存缓存。Preparation key 包含 branch id/revision、fanfic/canon cutoff、POV、participants、scene goal/query 与 role；Critic key 还绑定 staged draft hash。因此 branch revision 或 draft update 会自然使旧 cache 不再匹配。`forceRefresh` 可跳过当前匹配的 success cache。

本包不会自行池化 API credential。要真正缓解 provider rate limit，应让 fallback worker 的 child `agentOptions.provider` 和/或 `model` 使用独立 quota。多个 worker 如果最终都走同一个 API key，仍共享同一限额。

随 bundle 使用的 `DSH_FANFIC_WORKERS_JSON` 示例：

```json
[
  {"name":"canon-a","role":"canon","subagentProvider":"spawn","priority":1,"agentOptions":{"provider":"route-a","model":"fast-research","maxTokens":10000}},
  {"name":"canon-b","role":"canon","subagentProvider":"spawn","priority":2,"agentOptions":{"provider":"route-b","model":"fallback-research","maxTokens":10000}},
  {"name":"character-a","role":"character","subagentProvider":"spawn","priority":1,"agentOptions":{"provider":"route-b","model":"reasoning-medium","maxTokens":12000}},
  {"name":"story-a","role":"story","subagentProvider":"spawn","priority":1,"agentOptions":{"provider":"route-c","model":"reasoning-medium","maxTokens":12000}},
  {"name":"critic-a","role":"critic","subagentProvider":"spawn","priority":1,"agentOptions":{"provider":"route-d","model":"independent-critic","maxTokens":10000}}
]
```

`subagentProvider` 选择 DSH child transport（本工作流通常使用 `spawn`）；`agentOptions.provider` 选择 child 的 LLM route。配置的 subagent provider 必须同时声明 `outputSchema` 与 `toolFilter`；缺失 provider 或 capability 会作为可重试 worker failure 处理，而不会静默降级。

## 配置

| 键 | 含义 |
|---|---|
| `workers` | 非空 specialist worker pool；一次调用使用的每个角色至少需要一个可用 worker。 |
| `failureCooldownMs` | 可重试失败后的基础 cooldown；连续失败指数退避，最多 8×。 |
| `maxAttemptsPerRole` | 单个角色 dispatch 最多尝试的可用 worker 数。 |
| `maxParallelSpecialists` | 一次 `fanfic_prepare_chapter` 中最多并行运行的 preparation role 数。 |
| `cacheTtlMs` | 成功 specialist packet 的内存缓存寿命；`0` 基本等价于不跨时刻复用。 |
| `maxCacheEntries` | 最多保留的 success packet 数；按最早插入项淘汰。 |
| `packetMaxChars` | 一个完整 structured specialist packet 的 JSON 字符硬上限；超限作为可重试 worker failure。 |
| `resultMaxChars` | 每个 distributed tool call 的完整父级可见结果（含 packet wrapper 与诊断）的序列化字符硬上限。 |

## 模型体验

### 分布式作者策略

#### 模型看到的内容

包挂载时贡献以下稳定 system-prompt section：

##### 分布式策略原文

```markdown
Distributed fanfic authoring (API 0.8.0):
- At the parent author scope, you are the sole Author/Coordinator. If your current task explicitly identifies you as a distributed specialist child, that specialist task takes precedence: act only as a read-only advisory worker, use only visible child tools, return the required packet, and never write final prose or mutate/settle author state.
- Before a substantial chapter plan, prefer fanfic_prepare_chapter to fan out canon, character, and story analysis in parallel. Treat specialist packets as advice/evidence summaries, not authoritative branch state; resolve conflicts yourself against author_context and canon evidence.
- Specialists are read-only by enforced tool filters. If preparation returns complete=false, inspect failedRoles and retry rather than silently inventing missing canon constraints.
- After staging a meaningful draft, fanfic_review_draft may obtain an independent critic packet from another configured model/provider. Deterministic fanfic_audit, fanfic_style_audit, and anti_copy_guard remain mandatory and cannot be replaced by the critic.
- fanfic_worker_status shows the configured worker pool, provider capability availability, cooldowns, and cache state. Different worker models/providers are deployment configuration; the Author model remains the parent agent.
- Specialist success packets are cached only against state-sensitive keys (branch revision or staged-draft hash). Branch/draft changes therefore require fresh work automatically.
```

#### Token 影响

Author 请求承担固定 prompt 与三个 tool schema 的成本。Child research 消耗独立 child context；进入 Author history 的只有有界 structured packet、dispatch 诊断和 status row。

#### KV Cache 影响

只要本包策略、tool schema 与配置可见 shape 不变，Author 前缀保持稳定。每个 specialist child 拥有独立请求/cache history；切换 worker model/provider 会改变该 child 的 cache domain，不会破坏之前可复用的 Author 前缀。

### Preparation 与 critic 结果

#### 模型看到的内容

[`fanfic_prepare_chapter`](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fanfic-distributed) 返回按 role 分组的 packet、worker/fallback/cache metadata 与显式 `failedRoles`；partial preparation 不会伪造缺失角色。`fanfic_review_draft` 只针对当前 branch revision 的 staged draft 返回 critic packet。`fanfic_worker_status` 返回 health/config identity，不包含 credential 或 prompt。

#### Token 影响

每个成功 role packet 受 `packetMaxChars` 限制，结果按普通父级 history 保留直到 compaction。Specialist transcript 与中间工具调用留在 child session，不复制进 Author result。

#### KV Cache 影响

Tool result 只追加在可复用 Author 前缀之后。Packet cache 可以避免相同 branch/draft state 的重复 child request，但不会移除已留在对话历史中的父级结果。

## 已知限制与暂缓事项

- **Cooldown/cache 仅在进程内**：重启会清空 worker health 和 packet cache；本包不宣称提供持久化 rate-limit scheduler。
- **Quota 独立性由部署负责**：多个 worker 使用同一 provider credential 时仍可能撞上同一个 RPM/TPM 限额，甚至加大压力。
- **Specialist packet 只是建议**：structured output 和只读工具限制的是权限，不保证模型质量。Author 必须解决冲突，确定性 fanfic audits 仍是 settlement 权威。
- **Provider capability 要求**：worker transport 如果不同时支持 `outputSchema` 和 `toolFilter` 就不能用于本包，并会触发 fallback/failure。
