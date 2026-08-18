// ===== 工作台接口文件 =====
// 所有请求统一走 src/utils/request.js 封装好的 request（自动带 token、自动处理 401）
import request from "@/utils/request.js";

// ⚠️ 本文件 4 个接口的共同约定（已从后端 WorkSpaceController 源码确认）：
//   1. 全部是 GET 且不需要任何参数（统计口径后端定死：今天 00:00 起，前端不用传日期）
//   2. 返回统一是 Result 包装：result.code === 1 成功，数据在 result.data 里

// ✅ 今日运营数据（对应后端 GET /admin/workspace/businessData）
// 返回 data：{
//   turnover: 营业额(Double，可能为 null)、
//   validOrderCount: 有效订单数(Integer)、
//   orderCompletionRate: 订单完成率(Double，0~1 的小数，显示要乘 100，可能为 null)、
//   unitPrice: 平均客单价(Double，可能为 null)、
//   newUsers: 新增用户数(Integer)
// }
// ⚠️ 口径 = 今天 00:00 ~ 23:59，后端已经算好，前端拿到的就是"今日"值
export const businessDataApi = () => request.get('/workspace/businessData')

// ✅ 今日订单概览（对应后端 GET /admin/workspace/overviewOrders）
// 返回 data：{ placedOrders: 已下单数、completedOrders: 已完成数、cancelledOrders: 已取消数、allOrders: 全部订单数 }
// ⚠️ 大坑：placedOrders（已下单数）后端从没赋过值，永远返回 null，页面千万别用！
//    "已下单"数量用订单分页接口自己查（status=1 查第 1 页每页 1 条，只取 total 总数）
export const overviewOrdersApi = () => request.get('/workspace/overviewOrders')

// ✅ 菜品总览（对应后端 GET /admin/workspace/overviewDishes）
// 返回 data：{ sold: 已启售数量, discontinued: 已停售数量 }（全量统计；1=启售 0=停售）
export const overviewDishesApi = () => request.get('/workspace/overviewDishes')

// ✅ 套餐总览（对应后端 GET /admin/workspace/overviewSetmeals）
// 返回 data：{ sold: 已启售数量, discontinued: 已停售数量 }（全量统计；1=启售 0=停售）
export const overviewSetmealsApi = () => request.get('/workspace/overviewSetmeals')
