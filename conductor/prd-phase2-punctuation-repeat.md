# PRD: Phase 2 听写断点与节奏优化

## 概述

**功能名称：** Phase 2 标点断点复读 + 词间暂停  
**优先级：** P0（直接影响核心听写体验）  
**预估工期：** 0.5 天  
**分支：** `feature/phase2-punctuation-repeat`

## 背景与问题

当前 Phase 2（Dictée effective）的听写流程是：

1. 按句末标点（`. ! ?`）把原文分成若干"句子"
2. 每个句子内部按 word group 读两遍——**整句读完一遍再整句读第二遍**

学生反馈两个核心体验问题：

- **复读粒度太粗：** 一个长句可能有 3~5 个分句（逗号、分号等隔开），等整句读完再复读时，学生已经忘了前半句的内容。真正的老师听写时，每到一个标点就会停下来让学生写，然后把刚才那一小段复读一遍。
- **词间缺乏暂停：** 当前 word group 播放完就立刻播下一个 group，学生来不及书写。

## 目标

1. **以任意标点符号（`,;:…!?.`）为断点**，每读完一个"分句片段"就立即复读该片段
2. **在每个 word group 播放后**增加自适应书写暂停时间，让学生有时间写下来
3. 保持外层"句子"循环不变（符合 Brevet 2026 协议规范）
4. 所有现有测试不回归

## 用户故事

### US-1：以标点断点复读

> **作为**一名 3ème 学生  
> **我想要**在老师读到每个标点（逗号、分号、冒号等）时，自动复读刚才那一小段  
> **以便**我能在短期记忆清晰时写下内容，不用等整句结束再回忆

**验收标准：**
- 句子内部含有 `,` `;` `:` `…` 等标点时，在标点处切断形成"子句片段"
- 每个子句片段立即被第二遍复读，而不是等整句读完再复读
- 句末标点（`.` `!` `?`）也作为最后一个片段的断点
- UI 上在每个片段复读时正确显示 `1ère lecture` / `2ème lecture` 标识

### US-2：词间书写暂停

> **作为**一名 3ème 学生  
> **我想要**每个词组之间有足够的暂停时间  
> **以便**我能在暂停期间写下刚才听到的内容

**验收标准：**
- 每个 word group 播放后有自适应暂停（根据词组长度）
- 暂停时间范围：1.5s ~ 5s
- 第二遍复读时暂停适当延长（+500ms），给学生修正时间

## 技术方案

### 核心改动

1. **新增函数 `splitGroupsIntoClauseSegments(groups)`**
   - 输入：一个句子的 groups 列表（`string[]`）
   - 输出：`string[][]` — 按标点切成多个子句片段，每个片段包含若干 groups
   - 逻辑：遍历 groups，遇到尾部含有 `,;:…!?.` 的 group 时切断

2. **修改 `runDictee(runToken)`**
   - 外层循环：句子（不变）
   - 中层循环：**子句片段**（新增）
     - 第1遍：依次读片段内的 groups，每 group 后 `writingPauseMs` 暂停
     - 第2遍：同样方式读片段内的 groups，暂停稍长
   - 内层循环：word group（不变）

3. **更新 Phase 2 公告文案**

### 流程对比

**改动前：**
```
句子1: groups=[A, B逗号, C, D句号]
  → 第1遍: A → B, → C → D.
  → 第2遍: A → B, → C → D.
```

**改动后：**
```
句子1: groups=[A, B逗号, C, D句号]
  片段1=[A, B逗号]:
    → 第1遍: A → B,
    → 第2遍: A → B,
  片段2=[C, D句号]:
    → 第1遍: C → D.
    → 第2遍: C → D.
```

### 影响的文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/exam-flow.js` | MODIFY | 新增 `splitGroupsIntoClauseSegments`，修改 `runDictee` |
| `src/__tests__/exam-flow.test.js` | MODIFY | 新增 `splitGroupsIntoClauseSegments` 测试用例 |

### 不变的部分

- `splitIntoSentences` — 按句末标点分句，Brevet 协议要求
- `getWordGroups` / `autoSegmentSentence` — word group 逻辑不变
- `tts.js` / `pregenerate` — 预生成逻辑不需要改（仍然基于每个 group 生成音频）
- Phase 1 / Phase 3 — 完全不受影响

## 验证计划

### 自动化测试

```bash
docker run --rm -v $(pwd):/app -w /app node:lts-alpine sh -c "npm install && npm test"
```

**新增测试用例：**
- `splitGroupsIntoClauseSegments` 对含逗号 groups 的正确切分
- `splitGroupsIntoClauseSegments` 对不含内部标点句子的保持完整
- `splitGroupsIntoClauseSegments` 对多种标点混合的处理
- 所有现有测试不回归

### 手动验证

1. 启动应用：`./dev_stack.sh start docker`
2. 选择一篇含丰富内部标点的听写（如 id=2 "La tempête en mer"）
3. 进入 Phase 2 观察：
   - ✅ 在逗号、分号处暂停并复读该片段
   - ✅ 每个 word group 之间有明显的书写等待
   - ✅ UI 显示 `1ère lecture` / `2ème lecture` 在每个片段交替
   - ✅ 整体节奏更接近真实老师听写

## 风险与注意事项

- **预生成缓存兼容性：** 预生成仍按 group 粒度进行，新逻辑只是改变了"哪些 groups 连在一起读两遍"的组织方式，不影响缓存
- **无标点句子：** 如果句子内部没有任何标点（少见但可能），整句作为一个片段处理，行为和改动前一致
