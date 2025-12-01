# 📋 区间验证系统集成指南

## 🎯 更新概览

本次更新将 `intervalUtils.ts` 完整集成到 AlphaCouncil AI 系统中，实现了 **智能买卖区间验证与自动调整** 功能。

---

## ✅ 已完成的修改

### 1. 扩展股票数据获取 (`services/juheService.ts`)

#### 新增功能
- ✅ 添加 `ExtendedStockContext` 接口，用于存储区间验证所需数据
- ✅ 新增 `buildStockContext()` 函数，从原始股票数据构建上下文
- ✅ 新增 `estimateVolatility20d()` 函数，基于日振幅估算20日波动率
- ✅ 扩展 `formatStockDataForPrompt()` 输出，包含：
  - 日振幅百分比
  - 流动性评级（充足/一般/偏弱）
  - 大盘指数数据（如果API返回）

#### 数据结构示例
```typescript
const stockContext = {
  currentPrice: 100.5,
  dailyAmplitude: 4.2,          // 日振幅 4.2%
  volume: 12500000,              // 成交量（手）
  turnover: 125000000,           // 成交额（元）
  priceChange: 2.5,              // 涨跌幅 +2.5%
  volatility20d: 0.076,          // 20日波动率估算
  marketIndex: {                 // 大盘指数（可选）
    name: "上证指数",
    point: 3200.5,
    change: -0.8
  }
}
```

---

### 2. 优化提示词 (`constants.ts`)

#### 技术分析师提示词增强
```typescript
// 新增严格的区间输出格式要求
- 买入区间必须低于当前价至少6%
- 卖出区间必须高于当前价至少10%
- 区间宽度：买入≥4%，卖出≥5%
- 必须使用标准化格式：买入区间：85.50 - 90.20
```

#### 组合风险总监提示词调整
```typescript
// 基于实时数据调整风控参数
- 止损间距 ≥ 日振幅的2倍（避免频繁触发）
- 流动性要求：日均成交额 > 5000万元
- 硬止损建议：基于日振幅的[数字]倍设定硬止损点位
```

#### 总经理（GM）提示词重构
新增 **【买卖区间标准化规则】** 章节：

```markdown
1. 区间宽度要求：
   - 买入区间宽度 ≥ 当前价的4%
   - 卖出区间宽度 ≥ 当前价的5%
   - 总区间宽度 ≥ 当前价的12%

2. 与当前价距离要求：
   - 买入区间上限必须低于当前价至少6%
   - 卖出区间下限必须高于当前价至少10%

3. 区间分离要求：
   - 买入和卖出区间不得重叠
   - 间隔至少当前价的2%

4. 格式要求（便于系统解析）：
   - 必须使用中文冒号"："
   - 格式：买入区间：85.50 - 90.20
   - 禁止包含"元"、"左右"等文字
```

**正确示例**：
```
- 买入区间：85.50 - 90.20
- 卖出区间：110.30 - 118.50
- 止损：82.00
```

**错误示例**（系统将拒绝）：
```
❌ 买入区间：95-98元（过窄且包含单位）
❌ 买入：100左右（模糊表达）
❌ 买入区间为100-102（未使用冒号，过窄）
```

---

### 3. 主应用流程集成 (`App.tsx`)

#### 新增步骤 5：区间验证与调整

```typescript
// 在GM决策后自动执行
const extractedIntervals = extractIntervalsFromText(gmOutput);
if (extractedIntervals && stockData) {
  const stockContext = {
    currentPrice: parseFloat(stockData.nowPri),
    dailyAmplitude: ...,
    volume: ...,
    volatility20d: ...
  };
  
  const adjustedIntervals = validateAndAdjustIntervals(
    extractedIntervals,
    stockContext,
    undefined,
    AgentRole.GM
  );
  
  // 如果区间被调整，生成验证报告
  if (adjustedIntervals.adjustments.length > 0) {
    const report = generateIntervalReport(adjustedIntervals);
    // 追加到GM输出
    finalGMOutput += `

---

${report}`;
  }
}
```

#### 验证报告示例
```markdown
## 📊 区间验证报告

### 验证结果: ✅ 通过
- 总区间宽度: 15.2%
- 买入区间宽度: 4.8%
- 卖出区间宽度: 6.5%
- 买入区间低于当前价: 7.2%
- 卖出区间高于当前价: 12.5%

### 📈 调整后区间
- **买入区间**: 85.50 - 90.20
- **卖出区间**: 110.30 - 118.50
- **止损价格**: 82.00

### 🔧 自动调整项
- 买入区间宽度从3.2%扩大到4.0%
- 卖出区间上移2.50元以远离当前价

### 📋 建议
- ✅ 区间设置合理，符合波段交易要求
```

---

### 4. 类型定义扩展 (`types.ts`)

```typescript
// 新增股票上下文接口
export interface StockContext {
  currentPrice: number;
  volatility20d?: number;
  dailyAmplitude: number;
  volume: number;
}

// WorkflowState 添加 stockContext 字段
export interface WorkflowState {
  // ... 其他字段
  stockContext?: StockContext; // 存储股票上下文（用于区间验证）
}
```

---

## 🚀 工作流程

### 完整流程图

```
用户输入股票代码
    ↓
获取实时数据（聚合数据API）
    ↓
构建 StockContext（日振幅、成交量、波动率等）
    ↓
第一阶段：5位分析师并行分析
    ↓
第二阶段：2位总监整合
    ↓
第三阶段：2位风控评估
    ↓
第四阶段：总经理最终决策
    ↓
【新增】区间自动验证与调整
    ├─ 提取买入/卖出区间
    ├─ 验证宽度、距离、分离
    ├─ 自动调整不合规区间
    └─ 生成验证报告附加到输出
    ↓
展示完整分析结果
```

---

## 🔍 区间验证规则详解

### 默认验证标准
```typescript
{
  minTotalWidthPercent: 12,      // 总区间最小宽度 12%
  minBuyWidthPercent: 4,         // 买入区间最小宽度 4%
  minSellWidthPercent: 5,        // 卖出区间最小宽度 5%
  minBelowCurrentPercent: 6,     // 买入区间低于当前价 6%
  minAboveCurrentPercent: 10,    // 卖出区间高于当前价 10%
  maxBelowCurrentPercent: 25,    // 买入区间最大下限 25%
  maxAboveCurrentPercent: 35     // 卖出区间最大上限 35%
}
```

### 行业差异化设置

系统根据行业特性自动调整验证标准：

| 行业类型 | 总区间宽度 | 买入宽度 | 卖出宽度 | 示例 |
|---------|-----------|---------|---------|------|
| **高波动** (科技/医药) | 15-18% | 5-6% | 6-7% | 半导体、创新药 |
| **中波动** (消费/制造) | 10-12% | 3.5-4% | 4.5-5% | 白酒、汽车 |
| **低波动** (金融/公用) | 7-8% | 2.5-3% | 3.5-4% | 银行、电力 |

---

## 📦 文件依赖关系

```
intervalUtils.ts（核心工具类）
    ↓
types.ts (StockContext)
    ↓
juheService.ts (buildStockContext)
    ↓
App.tsx (集成验证流程)
    ↑
constants.ts (提示词约束AI输出格式)
```

---

## ⚙️ 配置与测试

### 本地测试

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
# 确保 .env 包含：
GEMINI_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
JUHE_API_KEY=your_key

# 3. 启动开发服务器
npm run dev

# 4. 访问测试
http://localhost:3000
```

### 测试用例

| 测试场景 | 输入股票代码 | 预期结果 |
|---------|-------------|---------|
| 高流动性大盘股 | 600519 | 区间较窄，验证通过 |
| 小盘高波动股 | 300750 | 区间自动扩大 |
| 流动性不足股 | XXX | 提示流动性预警 |

---

## 🛡️ 错误处理

### 区间提取失败
```typescript
// 如果无法从GM输出中提取区间
console.warn('[区间验证] 自动验证失败，保留原始输出');
// 不影响正常流程，仅跳过验证环节
```

### 数据缺失处理
```typescript
// 如果实时数据获取失败
if (!stockData) {
  setState({
    status: AnalysisStatus.ERROR,
    error: "无法获取股票数据，请检查API配置"
  });
  return; // 终止分析流程
}
```

---

## 🎯 后续优化建议

### 1. 增强波动率计算
- 当前使用简化估算：`volatility20d = dailyAmplitude * 1.8`
- 可接入历史数据API，计算真实20日波动率

### 2. 行业识别
- 当前需手动指定行业
- 可集成行业分类API自动识别

### 3. 用户自定义验证标准
- 允许用户在前端调整验证参数
- 保存个性化风控偏好

### 4. 回测功能
- 记录历史区间建议
- 统计区间调整后的回测收益率

---

## 📚 相关文档

- [intervalUtils.ts 源码](./intervalUtils.ts)
- [API 文档 - 聚合数据](./股票数据-沪深股市.pdf)
- [Vercel 部署指南](./VERCEL_DEPLOY.md)
- [更新日志](./UPDATE_LOG.md)

---

## ✅ 验收标准

- [x] 实时数据包含日振幅、成交额、大盘指数
- [x] 技术分析师输出标准化区间格式
- [x] GM决策遵守区间宽度和距离标准
- [x] 系统自动提取并验证区间
- [x] 验证报告清晰展示调整内容
- [x] 错误情况下不影响正常流程

---

**集成完成！** 🎉

现在系统已具备 **智能区间验证** 功能，确保所有投资建议符合波段交易标准，有效避免过窄区间和频繁止损。
