
// 后端代理服务器配置
// Vercel部署时自动使用相对路径
const BACKEND_API_URL = '/api/stock';

// 聚合数据返回的股票数据接口定义（根据官方文档更新）
export interface StockRealtimeData {
  gid: string; // 股票编号
  name: string; // 股票名称
  nowPri: string; // 当前价格
  increase: string; // 涨跌额
  increPer: string; // 涨跌百分比
  todayStartPri: string; // 今日开盘价
  yestodEndPri: string; // 昨日收盘价
  todayMax: string; // 今日最高价
  todayMin: string; // 今日最低价
  competitivePri?: string; // 竞买价
  reservePri?: string; // 竞卖价
  traNumber: string; // 成交量（手）
  traAmount: string; // 成交金额
  date: string; // 日期
  time: string; // 时间
  // 买卖盘口 (买1-5, 卖1-5)
  buyOne: string; buyOnePri: string;
  buyTwo: string; buyTwoPri: string;
  buyThree: string; buyThreePri: string;
  buyFour: string; buyFourPri: string;
  buyFive: string; buyFivePri: string;
  sellOne: string; sellOnePri: string;
  sellTwo: string; sellTwoPri: string;
  sellThree: string; sellThreePri: string;
  sellFour: string; sellFourPri: string;
  sellFive: string; sellFivePri: string;
  // 大盘数据（可选）
  dapandata?: DapanData;
}

// 大盘数据接口
export interface DapanData {
  dot: string; // 当前点位
  name: string; // 指数名称
  nowPic: string; // 涨跌点数
  rate: string; // 涨跌幅
  traAmount: string; // 成交额（亿）
  traNumber: string; // 成交量（万手）
}



// API响应结构
interface JuheApiResponse {
  resultcode: string;
  reason: string;
  result: Array<{
    data: StockRealtimeData;
    dapandata?: DapanData;
    gopicture?: {
      minurl: string; // 分时图K线
      dayurl: string; // 日K线
      weekurl: string; // 周K线
      monthurl: string; // 月K线
    };
  }>;
  error_code?: number;
}



/**
 * 获取实时股票数据
 * 通过本地后端代理服务器请求聚合数据 API，避免 CORS 问题
 */
export async function fetchStockData(symbol: string, apiKey?: string): Promise<StockRealtimeData | null> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/${symbol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, apiKey })
    });
    
    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    if (!result.success) {
      return null;
    }

    // 提取股票数据
    const stockData = result.data.data;
    
    // 数据验证：确保必要字段存在
    if (!stockData.gid || !stockData.name || !stockData.nowPri) {
      return null;
    }

    // 附加大盘数据（如果存在）
    if (result.data.dapandata) {
      stockData.dapandata = result.data.dapandata;
    }

    return stockData;

  } catch (error) {
    console.error('[AlphaCouncil] 获取股票数据失败:', error instanceof Error ? error.message : String(error));
    return null;
  }
}



/**
 * 将原始 JSON 数据格式化为 AI 可读的字符串
 * 根据聚合数据API文档格式优化输出
 */
export function formatStockDataForPrompt(data: StockRealtimeData | null): string {
  if (!data) return "无法获取实时行情数据 (API连接失败)，请依赖您的内部知识库或搜索工具。";

  // 计算成交量/成交额的可读格式
  const traNumberFormatted = parseFloat(data.traNumber) > 10000 
    ? `${(parseFloat(data.traNumber) / 10000).toFixed(2)}万手` 
    : `${data.traNumber}手`;
  
  const traAmountFormatted = parseFloat(data.traAmount) > 100000000
    ? `${(parseFloat(data.traAmount) / 100000000).toFixed(2)}亿元`
    : `${(parseFloat(data.traAmount) / 10000).toFixed(2)}万元`;
  
  // 计算日振幅
  const todayMax = parseFloat(data.todayMax);
  const todayMin = parseFloat(data.todayMin);
  const currentPrice = parseFloat(data.nowPri);
  const dailyAmplitude = ((todayMax - todayMin) / currentPrice) * 100;
  
  // 获取大盘数据
  const dapandata = data.dapandata;
  const marketIndexInfo = dapandata ? `
【大盘指数】
  指数名称: ${dapandata.name}
  当前点位: ${dapandata.dot}
  涨跌幅度: ${parseFloat(dapandata.rate) >= 0 ? '+' : ''}${dapandata.rate}%
  成交量: ${dapandata.traNumber}万手
  成交额: ${dapandata.traAmount}亿元
` : '';

  return `
╔═══════════════════════════════════════════════════════════╗
║           实时行情数据 (来源: 聚合数据API)                ║
╚═══════════════════════════════════════════════════════════╝

【基本信息】
  股票名称: ${data.name}
  股票代码: ${data.gid.toUpperCase()}
  数据时间: ${data.date} ${data.time}

【价格信息】
  当前价格: ¥${data.nowPri}
  涨跌幅度: ${parseFloat(data.increPer) >= 0 ? '+' : ''}${data.increPer}%
  涨跌金额: ${parseFloat(data.increase) >= 0 ? '+' : ''}¥${data.increase}
  今日开盘: ¥${data.todayStartPri}
  昨日收盘: ¥${data.yestodEndPri}
  今日最高: ¥${data.todayMax}
  今日最低: ¥${data.todayMin}
  ${data.competitivePri ? `竞买价: ¥${data.competitivePri}` : ''}
  ${data.reservePri ? `竞卖价: ¥${data.reservePri}` : ''}

【成交情况】
  成交量: ${traNumberFormatted}
  成交额: ${traAmountFormatted}
  日振幅: ${dailyAmplitude.toFixed(2)}%
  流动性: ${parseFloat(data.traAmount) > 100000000 ? '充足' : parseFloat(data.traAmount) > 50000000 ? '一般' : '偏弱'}${marketIndexInfo}

【五档盘口】（关键数据：研判买卖力量对比）
  ┌─────────────────────────────────────┐
  │ 卖五  ¥${data.sellFivePri.padEnd(8)} │ ${data.sellFive.padEnd(10)}手 │
  │ 卖四  ¥${data.sellFourPri.padEnd(8)} │ ${data.sellFour.padEnd(10)}手 │
  │ 卖三  ¥${data.sellThreePri.padEnd(8)} │ ${data.sellThree.padEnd(10)}手 │
  │ 卖二  ¥${data.sellTwoPri.padEnd(8)} │ ${data.sellTwo.padEnd(10)}手 │
  │ 卖一  ¥${data.sellOnePri.padEnd(8)} │ ${data.sellOne.padEnd(10)}手 │ ⬅️ 压力
  ├─────────────────────────────────────┤
  │ 买一  ¥${data.buyOnePri.padEnd(8)} │ ${data.buyOne.padEnd(10)}手 │ ⬅️ 支撑
  │ 买二  ¥${data.buyTwoPri.padEnd(8)} │ ${data.buyTwo.padEnd(10)}手 │
  │ 买三  ¥${data.buyThreePri.padEnd(8)} │ ${data.buyThree.padEnd(10)}手 │
  │ 买四  ¥${data.buyFourPri.padEnd(8)} │ ${data.buyFour.padEnd(10)}手 │
  │ 买五  ¥${data.buyFivePri.padEnd(8)} │ ${data.buyFive.padEnd(10)}手 │
  └─────────────────────────────────────┘

💡 分析提示: 请重点关注盘口买卖挂单量差异，判断主力意图
═══════════════════════════════════════════════════════════
  `;
}