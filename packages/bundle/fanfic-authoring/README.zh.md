# `@deepseek-ai/dsh-fanfic-authoring`

[English](README.md) | 中文

可选 bundle，挂载 `@deepseek-ai/dsh-fanfic`、local Provider 与面向模型的 fanfic tools。它不属于已交付的基础 profile，也不修改 agent loop。

默认读取 `./canon-packs/yishizhizun`，写入 `./.dsh-fanfic-state`；state root 保存 verified canon-enrichment row、enrichment coverage checkpoint，以及包含 Story Director 的持久 fanfic branch。Style Bank 位于 canon pack 的 `style/` 下；anti-copy 只生成审计结果，不把原作片段写入 branch state。可通过 `DSH_FANFIC_CANON_PACK` 与 `DSH_FANFIC_STATE_DIR` 覆盖。模型选择仍走普通 DeepSeek Harness 配置，因此 bundle 不绑定 DeepSeek 模型。

## Model Experience

间接地，由插入的 `@deepseek-ai/dsh-tool-fanfic` row 提供固定创作 policy、tool schema 与渲染后的 tool result。

#### KV Cache effect

只要挂载的 plugin composition 与配置不变，前缀就保持稳定。

## Known Limitations and Deferred Work

- **仅 opt-in** —— bundle 有意不修改 `dsh-base`、`web`、`headless` 默认配置；需要把它作为 patch 加到用于同人创作的 profile。
- **默认本地存储** —— 随附组合使用文件系统 Provider；Service Definition 刻意允许未来替换为 SQLite、vector 或 remote Provider，而无需改变模型工具。

## 调优

`cordis.patch.yml` 显式声明 Provider 与 Consumer 的所有部署型上限，包括 author-context 扩展、证据量、voice/style sample、Style Bank reference/excerpt、anti-copy 阈值/上限、enrichment batch 和 Story Director horizon。复制/覆盖该 patch 即可调优，而不需要修改 fanfic package 源码。

## v0.6 实模运行预检

构建 Harness 后、挂载真实模型前，先运行 `node scripts/fanfic/verify_runtime_bundle.mjs`。预检要求工具 API 为 `0.6.0`，并验证源码声明的每个 fanfic tool 都存在于已构建产物中，从而避免“源码已更新、runtime 仍加载旧 lib”的测试。真实创作会话还应首先调用 `fanfic_status`，确认 tool API `0.6.0`、branch format `2`、author-context version `3` 后再开始写作。
