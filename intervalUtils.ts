import { AgentRole } from './types';

// 区间验证和调整相关类型
export interface PriceInterval {
  buyRange: [number, number];
  sellRange: [number, number];
  stopLoss?: number;
}

export interface IntervalValidationOptions {
  minTotalWidthPercent: number;      // 总区间最小宽度百分比
  minBuyWidthPercent: number;        // 买入区间最小宽度
  minSellWidthPercent: number;       // 卖出区间最小宽度
  minBelowCurrentPercent: number;    // 买入区间低于当前价的最小百分比
  minAboveCurrentPercent: number;    // 卖出区间高于当前价的最小百分比
  maxBelowCurrentPercent?: number;   // 买入区间低于当前价的最大百分比（可选）
  maxAboveCurrentPercent?: number;   // 卖出区间高于当前价的最大百分比（可选）
}

export interface AdjustedInterval extends PriceInterval {
  adjustments: string[];
  validationResult: {
    meetsStandards: boolean;
    totalWidthPercent: number;
    buyWidthPercent: number;
    sellWidthPercent: number;
    belowCurrentPercent: number;
    aboveCurrentPercent: number;
  };
  warnings: string[];
}

export interface StockContext {
  currentPrice: number;
  volatility20d?: number;      // 20日波动率
  atr20d?: number;            // 20日平均真实波幅
  marketCap?: number;         // 市值（亿元）
  industry?: string;          // 行业
  dailyAmplitude?: number;    // 日振幅百分比
  volume?: number;            // 成交量
}

// 默认验证选项（根据不同角色可调整）
export const DEFAULT_VALIDATION_OPTIONS: IntervalValidationOptions = {
  minTotalWidthPercent: 12,
  minBuyWidthPercent: 4,
  minSellWidthPercent: 5,
  minBelowCurrentPercent: 6,
  minAboveCurrentPercent: 10,
  maxBelowCurrentPercent: 25,
  maxAboveCurrentPercent: 35
};

// 行业特定的区间设置
export const INDUSTRY_INTERVAL_SETTINGS: Record<string, IntervalValidationOptions> = {
  // 高波动行业
  '科技': {
    minTotalWidthPercent: 18,
    minBuyWidthPercent: 6,
    minSellWidthPercent: 7,
    minBelowCurrentPercent: 8,
    minAboveCurrentPercent: 12,
    maxBelowCurrentPercent: 30,
    maxAboveCurrentPercent: 40
  },
  '医药': {
    minTotalWidthPercent: 16,
    minBuyWidthPercent: 5,
    minSellWidthPercent: 6,
    minBelowCurrentPercent: 7,
    minAboveCurrentPercent: 11,
    maxBelowCurrentPercent: 28,
    maxAboveCurrentPercent: 38
  },
  '新能源': {
    minTotalWidthPercent: 15,
    minBuyWidthPercent: 5,
    minSellWidthPercent: 6,
    minBelowCurrentPercent: 7,
    minAboveCurrentPercent: 10,
    maxBelowCurrentPercent: 25,
    maxAboveCurrentPercent: 35
  },
  // 中波动行业
  '消费': {
    minTotalWidthPercent: 12,
    minBuyWidthPercent: 4,
    minSellWidthPercent: 5,
    minBelowCurrentPercent: 6,
    minAboveCurrentPercent: 8,
    maxBelowCurrentPercent: 20,
    maxAboveCurrentPercent: 30
  },
  '制造': {
    minTotalWidthPercent: 10,
    minBuyWidthPercent: 3.5,
    minSellWidthPercent: 4.5,
    minBelowCurrentPercent: 5,
    minAboveCurrentPercent: 7,
    maxBelowCurrentPercent: 18,
    maxAboveCurrentPercent: 28
  },
  // 低波动行业
  '金融': {
    minTotalWidthPercent: 8,
    minBuyWidthPercent: 3,
    minSellWidthPercent: 4,
    minBelowCurrentPercent: 4,
    minAboveCurrentPercent: 6,
    maxBelowCurrentPercent: 15,
    maxAboveCurrentPercent: 25
  },
  '公用事业': {
    minTotalWidthPercent: 7,
    minBuyWidthPercent: 2.5,
    minSellWidthPercent: 3.5,
    minBelowCurrentPercent: 4,
    minAboveCurrentPercent: 5,
    maxBelowCurrentPercent: 12,
    maxAboveCurrentPercent: 20
  }
};

// 智能体角色的默认验证选项
export const AGENT_VALIDATION_OPTIONS: Partial<Record<AgentRole, IntervalValidationOptions>> = {
  [AgentRole.TECHNICAL]: {
    minTotalWidthPercent: 10,
    minBuyWidthPercent: 4,
    minSellWidthPercent: 5,
    minBelowCurrentPercent: 5,
    minAboveCurrentPercent: 8
  },
  [AgentRole.GM]: {
    minTotalWidthPercent: 12,
    minBuyWidthPercent: 4,
    minSellWidthPercent: 5,
    minBelowCurrentPercent: 6,
    minAboveCurrentPercent: 10
  }
};

/**
 * 验证并调整交易区间
 */
export function validateAndAdjustIntervals(
  intervals: PriceInterval,
  stockContext: StockContext,
  options?: Partial<IntervalValidationOptions>,
  agentRole?: AgentRole
): AdjustedInterval {
  const currentPrice = stockContext.currentPrice;
  if (currentPrice <= 0) {
    throw new Error('当前价格必须大于0');
  }

  // 1. 确定验证选项（优先级：传入参数 > 角色设置 > 行业设置 > 默认设置）
  const finalOptions = {
    ...DEFAULT_VALIDATION_OPTIONS,
    ...(stockContext.industry ? 
      INDUSTRY_INTERVAL_SETTINGS[stockContext.industry] || {} : {}),
    ...(agentRole ? AGENT_VALIDATION_OPTIONS[agentRole] || {} : {}),
    ...(options || {})
  };

  // 2. 复制原始区间，避免修改原数据
  let { buyRange, sellRange, stopLoss } = intervals;
  buyRange = [...buyRange] as [number, number];
  sellRange = [...sellRange] as [number, number];
  
  const adjustments: string[] = [];
  const warnings: string[] = [];

  // 3. 验证买入区间
  validateAndAdjustBuyRange(buyRange, currentPrice, finalOptions, stockContext, adjustments, warnings);
  
  // 4. 验证卖出区间
  validateAndAdjustSellRange(sellRange, currentPrice, finalOptions, stockContext, adjustments, warnings);
  
  // 5. 验证区间不重叠
  validateNoOverlap(buyRange, sellRange, adjustments);
  
  // 6. 调整止损价格（如果存在）
  if (stopLoss !== undefined) {
    stopLoss = adjustStopLoss(stopLoss, buyRange, currentPrice, finalOptions, adjustments, warnings);
  }

  // 7. 计算验证结果
  const validationResult = calculateValidationResult(buyRange, sellRange, currentPrice, finalOptions);

  return {
    buyRange,
    sellRange,
    stopLoss,
    adjustments,
    validationResult,
    warnings
  };
}

/**
 * 验证并调整买入区间
 */
function validateAndAdjustBuyRange(
  buyRange: [number, number],
  currentPrice: number,
  options: IntervalValidationOptions,
  stockContext: StockContext,
  adjustments: string[],
  warnings: string[]
): void {
  const [buyLow, buyHigh] = buyRange;
  
  // 基本验证
  if (buyLow >= buyHigh) {
    buyRange[0] = currentPrice * 0.85;
    buyRange[1] = currentPrice * 0.90;
    adjustments.push('买入区间上下限颠倒，已自动修正');
  }
  
  if (buyLow <= 0 || buyHigh <= 0) {
    buyRange[0] = currentPrice * 0.85;
    buyRange[1] = currentPrice * 0.90;
    adjustments.push('买入区间包含非正数，已自动修正');
  }

  // 计算当前参数
  const buyWidth = buyHigh - buyLow;
  const buyWidthPercent = (buyWidth / currentPrice) * 100;
  const belowCurrentPercent = ((currentPrice - buyHigh) / currentPrice) * 100;
  const buyLowPercent = ((currentPrice - buyLow) / currentPrice) * 100;

  // 检查宽度是否足够
  if (buyWidthPercent < options.minBuyWidthPercent) {
    const targetWidth = options.minBuyWidthPercent * currentPrice / 100;
    const expandBy = (targetWidth - buyWidth) / 2;
    
    // 向下扩大更多，向上扩大较少
    buyRange[0] = Math.max(buyLow - expandBy * 1.2, buyLow * 0.8);
    buyRange[1] = buyHigh - expandBy * 0.8;
    
    adjustments.push(`买入区间宽度从${buyWidthPercent.toFixed(1)}%扩大到${options.minBuyWidthPercent}%`);
  }

  // 检查是否低于当前价足够
  if (belowCurrentPercent < options.minBelowCurrentPercent) {
    const targetBelow = options.minBelowCurrentPercent * currentPrice / 100;
    const adjustAmount = targetBelow - (currentPrice - buyHigh);
    
    // 整体下移买入区间
    buyRange[0] -= adjustAmount * 0.7;
    buyRange[1] -= adjustAmount * 0.3;
    
    adjustments.push(`买入区间下调${adjustAmount.toFixed(2)}元以远离当前价`);
  }

  // 检查是否过于远离（如果有最大限制）
  if (options.maxBelowCurrentPercent && buyLowPercent > options.maxBelowCurrentPercent) {
    const maxBelow = options.maxBelowCurrentPercent * currentPrice / 100;
    const adjustAmount = (currentPrice - buyLow) - maxBelow;
    
    buyRange[0] += adjustAmount * 0.8;
    warnings.push(`买入区间下限过于远离当前价(${buyLowPercent.toFixed(1)}%)，已上移`);
  }

  // 考虑波动率调整
  if (stockContext.atr20d && stockContext.atr20d > 0) {
    const atrMultiplier = 2.5; // 使用2.5倍ATR作为参考
    const atrBasedWidth = stockContext.atr20d * atrMultiplier;
    
    if (buyWidth < atrBasedWidth * 0.8) {
      const expandTo = atrBasedWidth;
      const expandBy = (expandTo - buyWidth) / 2;
      buyRange[0] -= expandBy * 1.2;
      buyRange[1] += expandBy * 0.8;
      
      adjustments.push(`基于ATR(${stockContext.atr20d.toFixed(2)})调整买入区间宽度`);
    }
  }

  // 确保买入区间上限低于当前价
  if (buyRange[1] >= currentPrice * 0.99) {
    buyRange[1] = currentPrice * 0.94;
    buyRange[0] = buyRange[1] * 0.95;
    adjustments.push('买入区间上限过于接近当前价，已下移');
  }

  // 最终安全限制
  buyRange[0] = Math.max(buyRange[0], currentPrice * 0.5); // 不低于当前价的50%
  buyRange[1] = Math.min(buyRange[1], currentPrice * 0.96); // 不高于当前价的96%
}

/**
 * 验证并调整卖出区间
 */
function validateAndAdjustSellRange(
  sellRange: [number, number],
  currentPrice: number,
  options: IntervalValidationOptions,
  stockContext: StockContext,
  adjustments: string[],
  warnings: string[]
): void {
  const [sellLow, sellHigh] = sellRange;
  
  // 基本验证
  if (sellLow >= sellHigh) {
    sellRange[0] = currentPrice * 1.10;
    sellRange[1] = currentPrice * 1.15;
    adjustments.push('卖出区间上下限颠倒，已自动修正');
  }
  
  if (sellLow <= 0 || sellHigh <= 0) {
    sellRange[0] = currentPrice * 1.10;
    sellRange[1] = currentPrice * 1.15;
    adjustments.push('卖出区间包含非正数，已自动修正');
  }

  // 计算当前参数
  const sellWidth = sellHigh - sellLow;
  const sellWidthPercent = (sellWidth / currentPrice) * 100;
  const aboveCurrentPercent = ((sellLow - currentPrice) / currentPrice) * 100;
  const sellHighPercent = ((sellHigh - currentPrice) / currentPrice) * 100;

  // 检查宽度是否足够
  if (sellWidthPercent < options.minSellWidthPercent) {
    const targetWidth = options.minSellWidthPercent * currentPrice / 100;
    const expandBy = (targetWidth - sellWidth) / 2;
    
    // 向上扩大更多，向下扩大较少
    sellRange[0] = sellLow + expandBy * 0.8;
    sellRange[1] = sellHigh + expandBy * 1.2;
    
    adjustments.push(`卖出区间宽度从${sellWidthPercent.toFixed(1)}%扩大到${options.minSellWidthPercent}%`);
  }

  // 检查是否高于当前价足够
  if (aboveCurrentPercent < options.minAboveCurrentPercent) {
    const targetAbove = options.minAboveCurrentPercent * currentPrice / 100;
    const adjustAmount = targetAbove - (sellLow - currentPrice);
    
    // 整体上移卖出区间
    sellRange[0] += adjustAmount * 0.3;
    sellRange[1] += adjustAmount * 0.7;
    
    adjustments.push(`卖出区间上移${adjustAmount.toFixed(2)}元以远离当前价`);
  }

  // 检查是否过于远离（如果有最大限制）
  if (options.maxAboveCurrentPercent && sellHighPercent > options.maxAboveCurrentPercent) {
    const maxAbove = options.maxAboveCurrentPercent * currentPrice / 100;
    const adjustAmount = (sellHigh - currentPrice) - maxAbove;
    
    sellRange[1] -= adjustAmount * 0.8;
    warnings.push(`卖出区间上限过于远离当前价(${sellHighPercent.toFixed(1)}%)，已下移`);
  }

  // 考虑波动率调整
  if (stockContext.atr20d && stockContext.atr20d > 0) {
    const atrMultiplier = 3; // 卖出区间使用3倍ATR
    const atrBasedWidth = stockContext.atr20d * atrMultiplier;
    
    if (sellWidth < atrBasedWidth * 0.8) {
      const expandTo = atrBasedWidth;
      const expandBy = (expandTo - sellWidth) / 2;
      sellRange[0] -= expandBy * 0.8;
      sellRange[1] += expandBy * 1.2;
      
      adjustments.push(`基于ATR(${stockContext.atr20d.toFixed(2)})调整卖出区间宽度`);
    }
  }

  // 确保卖出区间下限高于当前价
  if (sellRange[0] <= currentPrice * 1.01) {
    sellRange[0] = currentPrice * 1.06;
    sellRange[1] = sellRange[0] * 1.05;
    adjustments.push('卖出区间下限过于接近当前价，已上移');
  }

  // 最终安全限制
  sellRange[0] = Math.max(sellRange[0], currentPrice * 1.04); // 不低于当前价的104%
  sellRange[1] = Math.min(sellRange[1], currentPrice * 2);    // 不高于当前价的200%
}

/**
 * 验证区间不重叠
 */
function validateNoOverlap(
  buyRange: [number, number],
  sellRange: [number, number],
  adjustments: string[]
): void {
  const [, buyHigh] = buyRange;
  const [sellLow] = sellRange;
  
  // 确保买入区间和卖出区间有足够间隔（至少当前价格的2%）
  const minGap = Math.max(buyHigh * 0.02, (sellLow - buyHigh) * 0.1);
  
  if (buyHigh >= sellLow - minGap) {
    // 区间重叠或太近，调整卖出区间上移
    const overlap = buyHigh - (sellLow - minGap);
    const adjustSellBy = overlap + minGap * 2;
    
    sellRange[0] += adjustSellBy;
    sellRange[1] += adjustSellBy;
    
    adjustments.push(`买入卖出区间过于接近，已增加间隔${adjustSellBy.toFixed(2)}元`);
  }
}

/**
 * 调整止损价格
 */
function adjustStopLoss(
  stopLoss: number,
  buyRange: [number, number],
  currentPrice: number,
  options: IntervalValidationOptions,
  adjustments: string[],
  warnings: string[]
): number {
  const [, buyHigh] = buyRange;
  
  // 止损应低于买入区间下限
  const buyLow = buyRange[0];
  const idealStopLoss = buyLow * 0.95; // 低于买入下限5%
  
  if (stopLoss >= buyLow) {
    warnings.push(`止损价(${stopLoss})高于买入区间下限(${buyLow})，已自动调整`);
    return idealStopLoss;
  }
  
  // 止损不应过于远离
  const stopLossPercent = ((buyLow - stopLoss) / currentPrice) * 100;
  if (stopLossPercent > 8) { // 止损距离超过8%
    const adjustedStopLoss = buyLow * 0.97; // 调整为低于买入下限3%
    adjustments.push(`止损过于严格(${stopLossPercent.toFixed(1)}%)，调整为低于买入下限3%`);
    return adjustedStopLoss;
  }
  
  return stopLoss;
}

/**
 * 计算验证结果
 */
function calculateValidationResult(
  buyRange: [number, number],
  sellRange: [number, number],
  currentPrice: number,
  options: IntervalValidationOptions
) {
  const [buyLow, buyHigh] = buyRange;
  const [sellLow, sellHigh] = sellRange;
  
  const buyWidth = buyHigh - buyLow;
  const sellWidth = sellHigh - sellLow;
  const totalWidth = sellHigh - buyLow;
  
  const buyWidthPercent = (buyWidth / currentPrice) * 100;
  const sellWidthPercent = (sellWidth / currentPrice) * 100;
  const totalWidthPercent = (totalWidth / currentPrice) * 100;
  const belowCurrentPercent = ((currentPrice - buyHigh) / currentPrice) * 100;
  const aboveCurrentPercent = ((sellLow - currentPrice) / currentPrice) * 100;
  
  const meetsStandards = 
    totalWidthPercent >= options.minTotalWidthPercent &&
    buyWidthPercent >= options.minBuyWidthPercent &&
    sellWidthPercent >= options.minSellWidthPercent &&
    belowCurrentPercent >= options.minBelowCurrentPercent &&
    aboveCurrentPercent >= options.minAboveCurrentPercent;
  
  return {
    meetsStandards,
    totalWidthPercent: Number(totalWidthPercent.toFixed(1)),
    buyWidthPercent: Number(buyWidthPercent.toFixed(1)),
    sellWidthPercent: Number(sellWidthPercent.toFixed(1)),
    belowCurrentPercent: Number(belowCurrentPercent.toFixed(1)),
    aboveCurrentPercent: Number(aboveCurrentPercent.toFixed(1))
  };
}

/**
 * 从文本中提取价格区间（辅助函数）
 */
export function extractIntervalsFromText(text: string): PriceInterval | null {
  // 匹配买入区间模式（支持多种格式，包括 Markdown 加粗）
  const buyPatterns = [
    /\*{0,2}买入区间[：:]?\*{0,2}\s*\*{0,2}\[?\s*([\d.]+)\s*[-~—]\s*([\d.]+)\s*\]?\*{0,2}/i,  // **买入区间：** [27.80 - 28.80] 或 **买入区间：** 27.80 - 28.80
    /买入区间[：:]?\s*\[?\s*([\d.]+)\s*[-~—]\s*([\d.]+)\s*\]?/i,                              // 买入区间：[27.80 - 28.80] 或 买入区间：27.80 - 28.80
    /买入[：:]?\s*\[?\s*([\d.]+)\s*[-~—]\s*([\d.]+)\s*\]?/i,                                  // 买入：[27.80 - 28.80]
    /买入价[：:]?\s*([\d.]+)\s*[-~—]\s*([\d.]+)/i                                            // 买入价：27.80 - 28.80
  ];
  
  // 匹配卖出区间模式（支持多种格式，包括 Markdown 加粗）
  const sellPatterns = [
    /\*{0,2}卖出区间[：:]?\*{0,2}\s*\*{0,2}\[?\s*([\d.]+)\s*[-~—]\s*([\d.]+)\s*\]?\*{0,2}/i,  // **卖出区间：** [33.50 - 35.50] 或 **卖出区间：** 33.50 - 35.50
    /卖出区间[：:]?\s*\[?\s*([\d.]+)\s*[-~—]\s*([\d.]+)\s*\]?/i,                              // 卖出区间：[33.50 - 35.50] 或 卖出区间：33.50 - 35.50
    /卖出[：:]?\s*\[?\s*([\d.]+)\s*[-~—]\s*([\d.]+)\s*\]?/i,                                  // 卖出：[33.50 - 35.50]
    /卖出价[：:]?\s*([\d.]+)\s*[-~—]\s*([\d.]+)/i                                            // 卖出价：33.50 - 35.50
  ];
  
  const stopLossPattern = /\*{0,2}止损[：:]?\*{0,2}\s*([\d.]+)/i;
  
  // 尝试所有买入模式
  let buyMatch = null;
  for (const pattern of buyPatterns) {
    buyMatch = text.match(pattern);
    if (buyMatch) {
      console.log('[区间提取] 买入匹配成功，使用模式:', pattern.source);
      break;
    }
  }
  
  // 尝试所有卖出模式
  let sellMatch = null;
  for (const pattern of sellPatterns) {
    sellMatch = text.match(pattern);
    if (sellMatch) {
      console.log('[区间提取] 卖出匹配成功，使用模式:', pattern.source);
      break;
    }
  }
  
  const stopLossMatch = text.match(stopLossPattern);
  
  if (!buyMatch || !sellMatch) {
    // 调试日志
    console.warn('[区间提取] 未能提取到完整区间');
    console.warn('[区间提取] 买入匹配:', buyMatch ? '成功' : '失败');
    console.warn('[区间提取] 卖出匹配:', sellMatch ? '成功' : '失败');
    console.warn('[区间提取] 文本片段:', text.substring(0, 500));
    return null;
  }
  
  const buyLow = parseFloat(buyMatch[1]);
  const buyHigh = parseFloat(buyMatch[2]);
  const sellLow = parseFloat(sellMatch[1]);
  const sellHigh = parseFloat(sellMatch[2]);
  const stopLoss = stopLossMatch ? parseFloat(stopLossMatch[1]) : undefined;
  
  if (isNaN(buyLow) || isNaN(buyHigh) || isNaN(sellLow) || isNaN(sellHigh)) {
    console.warn('[区间提取] 数值解析失败:', { buyLow, buyHigh, sellLow, sellHigh });
    return null;
  }
  
  // 确保顺序正确
  const sortedBuyRange: [number, number] = [
    Math.min(buyLow, buyHigh),
    Math.max(buyLow, buyHigh)
  ];
  
  const sortedSellRange: [number, number] = [
    Math.min(sellLow, sellHigh),
    Math.max(sellLow, sellHigh)
  ];
  
  console.log('[区间提取] ✅ 成功提取:', {
    buyRange: sortedBuyRange,
    sellRange: sortedSellRange,
    stopLoss
  });
  
  return {
    buyRange: sortedBuyRange,
    sellRange: sortedSellRange,
    stopLoss
  };
}

/**
 * 生成区间验证报告
 */
export function generateIntervalReport(adjusted: AdjustedInterval): string {
  const { buyRange, sellRange, stopLoss, validationResult, adjustments, warnings } = adjusted;
  const { meetsStandards, totalWidthPercent, buyWidthPercent, sellWidthPercent, belowCurrentPercent, aboveCurrentPercent } = validationResult;
  
  let report = `## 📊 区间验证报告\n\n`;
  
  report += `### 验证结果: ${meetsStandards ? '✅ 通过' : '⚠️ 未完全通过'}\n`;
  report += `- 总区间宽度: ${totalWidthPercent}%\n`;
  report += `- 买入区间宽度: ${buyWidthPercent}%\n`;
  report += `- 卖出区间宽度: ${sellWidthPercent}%\n`;
  report += `- 买入区间低于当前价: ${belowCurrentPercent}%\n`;
  report += `- 卖出区间高于当前价: ${aboveCurrentPercent}%\n\n`;
  
  report += `### 📈 调整后区间\n`;
  report += `- **买入区间**: ${buyRange[0].toFixed(2)} - ${buyRange[1].toFixed(2)}\n`;
  report += `- **卖出区间**: ${sellRange[0].toFixed(2)} - ${sellRange[1].toFixed(2)}\n`;
  if (stopLoss) {
    report += `- **止损价格**: ${stopLoss.toFixed(2)}\n`;
  }
  
  if (adjustments.length > 0) {
    report += `\n### 🔧 自动调整项\n`;
    adjustments.forEach(adj => {
      report += `- ${adj}\n`;
    });
  }
  
  if (warnings.length > 0) {
    report += `\n### ⚠️ 警告信息\n`;
    warnings.forEach(warning => {
      report += `- ${warning}\n`;
    });
  }
  
  report += `\n### 📋 建议\n`;
  if (totalWidthPercent < 10) {
    report += `- ❗ 总区间宽度(${totalWidthPercent}%)偏小，建议考虑波动率扩大区间\n`;
  }
  if (belowCurrentPercent < 5) {
    report += `- ❗ 买入区间距离当前价较近(${belowCurrentPercent}%)，可能缺乏安全边际\n`;
  }
  if (aboveCurrentPercent < 8) {
    report += `- ❗ 卖出区间距离当前价较近(${aboveCurrentPercent}%)，可能缺乏盈利空间\n`;
  }
  
  if (meetsStandards && totalWidthPercent >= 12 && belowCurrentPercent >= 6 && aboveCurrentPercent >= 10) {
    report += `- ✅ 区间设置合理，符合波段交易要求\n`;
  }
  
  return report;
}

/**
 * 根据股票特性推荐验证选项
 */
export function recommendValidationOptions(stockContext: StockContext): IntervalValidationOptions {
  const baseOptions = { ...DEFAULT_VALIDATION_OPTIONS };
  
  // 根据市值调整
  if (stockContext.marketCap) {
    if (stockContext.marketCap < 50) { // 小盘股
      baseOptions.minTotalWidthPercent += 3;
      baseOptions.minBuyWidthPercent += 1;
      baseOptions.minSellWidthPercent += 1;
      baseOptions.minBelowCurrentPercent += 1;
      baseOptions.minAboveCurrentPercent += 2;
    } else if (stockContext.marketCap > 500) { // 大盘股
      baseOptions.minTotalWidthPercent -= 2;
      baseOptions.minBuyWidthPercent -= 0.5;
      baseOptions.minSellWidthPercent -= 0.5;
      baseOptions.minBelowCurrentPercent -= 1;
      baseOptions.minAboveCurrentPercent -= 1;
    }
  }
  
  // 根据波动率调整
  if (stockContext.volatility20d) {
    if (stockContext.volatility20d > 0.03) { // 高波动率 (>3%)
      baseOptions.minTotalWidthPercent += Math.round(stockContext.volatility20d * 100 * 0.5);
      baseOptions.minBuyWidthPercent += Math.round(stockContext.volatility20d * 100 * 0.2);
      baseOptions.minSellWidthPercent += Math.round(stockContext.volatility20d * 100 * 0.3);
    }
  }
  
  // 根据日振幅调整
  if (stockContext.dailyAmplitude) {
    if (stockContext.dailyAmplitude > 5) {
      baseOptions.minTotalWidthPercent += 2;
      baseOptions.minAboveCurrentPercent += 1;
    }
  }
  
  return baseOptions;
}