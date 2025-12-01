/**
 * 区间验证工具测试脚本
 * 用于验证 intervalUtils.ts 的区间提取和验证功能
 */

import { extractIntervalsFromText, validateAndAdjustIntervals, generateIntervalReport, type StockContext } from './intervalUtils';

// 测试用例 1: 标准格式的GM输出
const testCase1 = `
### 🧭 最终指令
【🟢 买入】

### 📌 仓位
【60%】

### 📈 操作区间
- **买入区间：** 85.50 - 90.20
- **卖出区间：** 110.30 - 118.50

### 🛑 止损红线
**止损：** 82.00
`;

// 测试用例 2: 区间过窄的GM输出（需要自动调整）
const testCase2 = `
### 📈 操作区间
- **买入区间：** 95.00 - 97.00
- **卖出区间：** 102.00 - 105.00

### 🛑 止损红线
**止损：** 93.00
`;

// 测试用例 3: 多种格式混合
const testCase3 = `
- 买入区间：88.5-92.3
- 卖出区间: 108.0 - 115.5
- 止损价格：85.0
`;

// 模拟股票上下文
const mockStockContext: StockContext = {
  currentPrice: 100.0,
  dailyAmplitude: 4.2,
  volume: 12500000,
  volatility20d: 0.076
};

console.log('========================================');
console.log('📊 区间验证工具测试');
console.log('========================================\n');

// 测试 1: 标准格式提取
console.log('【测试 1】标准格式提取');
console.log('输入文本:', testCase1.trim());
const intervals1 = extractIntervalsFromText(testCase1);
console.log('提取结果:', intervals1);
console.log('');

if (intervals1) {
  const adjusted1 = validateAndAdjustIntervals(intervals1, mockStockContext);
  console.log('验证结果:', adjusted1.validationResult);
  console.log('调整项数量:', adjusted1.adjustments.length);
  console.log('警告数量:', adjusted1.warnings.length);
  console.log('\n生成的报告:');
  console.log(generateIntervalReport(adjusted1));
}

console.log('\n========================================\n');

// 测试 2: 过窄区间自动调整
console.log('【测试 2】过窄区间自动调整');
console.log('输入文本:', testCase2.trim());
const intervals2 = extractIntervalsFromText(testCase2);
console.log('提取结果:', intervals2);
console.log('');

if (intervals2) {
  const adjusted2 = validateAndAdjustIntervals(intervals2, mockStockContext);
  console.log('验证结果:', adjusted2.validationResult);
  console.log('调整项:', adjusted2.adjustments);
  console.log('调整后买入区间:', adjusted2.buyRange);
  console.log('调整后卖出区间:', adjusted2.sellRange);
}

console.log('\n========================================\n');

// 测试 3: 多格式兼容性
console.log('【测试 3】多格式兼容性测试');
console.log('输入文本:', testCase3.trim());
const intervals3 = extractIntervalsFromText(testCase3);
console.log('提取结果:', intervals3);

console.log('\n========================================');
console.log('✅ 测试完成');
console.log('========================================');

export {};
