# 一世之尊 canon pack

[English](README.md) | 中文

供 DeepSeek Harness 同人创作 Provider 使用的本地派生 canon pack。

- 书名：`一世之尊`
- 作者：`爱潜水的乌贼`
- 叙事记录数：`1409`
- 来源 EPUB SHA-256：`760489c4ea428faa5d629fa0219ab7975424efa67d5e3b33dc8fc56d08224135`
- 原始 EPUB：本 workspace 不包含

`chapters.ndjson` 按 EPUB spine 的叙事顺序确定性提取。`graph/*.ndjson` 刻意保持稀疏。`scripts/fanfic/seed_yishizhizun.py` 仅在预期章节 hash 与证据短语都和提取来源匹配时才接纳 seed 记录，因此 seed 不会在换版本或章节错位时悄然继续生效。

`style/style-bank.json` 是对同一 1,409 个章节生成的确定性无正文派生索引，只保存 chapter hash、句段/对话/标点指标与宽泛 scene mode 的启发式分数，不包含原作正文。`scripts/fanfic/build_style_bank.py` 可由 `chapters.ndjson` 重建。运行时选择风格参考窗口时仍先应用 `asOfChapter`；独立 anti-copy guard 可以扫描完整不可变 corpus，但未来命中不会泄露来源位置。

当前已验证锚点覆盖前期修炼体系说明、小紫/顾小桑的 reveal 时机、首次系统说明 法身 之后的道路、真实界/诸天万界框架、真慧/杨戬的 reveal 时机、历史改写语义、传说→造化→彼岸进阶、后期境界对应的记忆语义、关系状态、时间线规则，以及一条有原文证据支持的高层因果联系。

若要大规模扩充 graph，应把 LLM 抽取视为提案阶段：要求章节 provenance，重新获取不可变来源并验证证据，然后才接纳结构化记录。不要把模型批量输出直接写入 graph 并当作 canon truth。
