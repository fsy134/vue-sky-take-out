// ===== 订单管理接口文件 =====
// 所有请求统一走 src/utils/request.js 封装好的 request（自动带 token、自动处理 401）
import request from "@/utils/request.js";

// ✅ 订单条件分页查询（对应后端 GET /admin/order/conditionSearch）
// number：订单号（模糊查询，可为空）
// phone：手机号（模糊查询，可为空）
// status：订单状态（1待付款 2待接单 3已接单 4派送中 5已完成 6已取消；空=查全部）
// beginTime / endTime：下单时间范围，格式必须是 "yyyy-MM-dd HH:mm:ss"（后端日期格式要求）
// ⚠️ 老规矩：空参数一律传 null，axios 会自动把 null 参数从地址里去掉，后端才不会报错
export const orderPageApi = (number, phone, status, beginTime, endTime, page, pageSize) =>
  request.get('/order/conditionSearch', {
    params: {
      number: number || null,
      phone: phone || null,
      status: status === '' ? null : status,   // ✅ 空串才扔，具体状态值原样保留
      beginTime: beginTime || null,
      endTime: endTime || null,
      page,
      pageSize
    }
  })

// ✅ 按 id 查询订单详情（"查看"弹窗用）
// 返回的订单数据里带 orderDetailList 订单明细数组（每道菜的 名称/图片/口味/数量/金额）
export const searchOrderDetailApi = (id) => request.get(`/order/details/${id}`)

// ✅ 取消订单（对应后端 PUT /admin/order/cancel）
// 后端要求请求体传 { id: 订单id, cancelReason: 取消原因 }
export const cancelOrderApi = (id, cancelReason) => request.put('/order/cancel', { id, cancelReason })
