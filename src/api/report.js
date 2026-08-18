// ===== 数据统计接口文件 =====
// 所有请求统一走 src/utils/request.js 封装好的 request（自动带 token、自动处理 401）
import request from "@/utils/request.js";

// ⚠️ 四个接口的共同约定（已从后端 ReportController 源码确认）：
//   1. 参数都是 begin / end（统计日期范围），格式必须是 "yyyy-MM-dd"（如 2026-08-12）
//   2. 返回 data 里的"列表字段"都是逗号分隔的一串文字（如 "406.0,1520.0"），
//      页面里要用 .split(',') 拆成数组才能喂给图表
//   3. 与订单接口不同：本页 begin/end 永远有值（5 个日期预设按钮都会算出日期），
//      所以不需要"空参数传 null"那套处理

// ✅ 营业额统计（对应后端 GET /admin/report/turnoverStatistics）
// begin / end：统计日期范围，格式 "yyyy-MM-dd"
// 返回 data：{ dateList: "2026-08-12,2026-08-13", turnoverList: "406.0,1520.0" }（每天的营业额）
export const turnoverStatisticsApi = (begin, end) =>
  request.get('/report/turnoverStatistics', { params: { begin, end } })

// ✅ 用户统计（对应后端 GET /admin/report/userStatistics）
// begin / end：统计日期范围，格式 "yyyy-MM-dd"
// 返回 data：{ dateList, totalUserList: "200,210"（每天的用户总量）, newUserList: "20,21"（每天新增用户数）}
export const userStatisticsApi = (begin, end) =>
  request.get('/report/userStatistics', { params: { begin, end } })

// ✅ 订单统计（对应后端 GET /admin/report/ordersStatistics）
// begin / end：统计日期范围，格式 "yyyy-MM-dd"
// 返回 data：
//   dateList / orderCountList / validOrderCountList：逗号分隔字符串（每天订单数 / 每天有效订单数）
//   totalOrderCount / validOrderCount：数字（整个期间订单总数 / 有效订单总数）
//   orderCompletionRate：小数（订单完成率，如 0.98 表示 98%，页面要乘 100 再显示）
export const ordersStatisticsApi = (begin, end) =>
  request.get('/report/ordersStatistics', { params: { begin, end } })

// ✅ 销量排名 TOP10（对应后端 GET /admin/report/top10）
// begin / end：统计日期范围，格式 "yyyy-MM-dd"
// 返回 data：{ nameList: "鱼香肉丝,宫保鸡丁", numberList: "260,215" }（商品名和销量一一对应）
export const top10Api = (begin, end) =>
  request.get('/report/top10', { params: { begin, end } })
