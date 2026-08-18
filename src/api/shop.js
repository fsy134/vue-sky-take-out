// ===== 店铺营业状态接口文件 =====
// 所有请求统一走 src/utils/request.js 封装好的 request（自动带 token、自动处理 401）
import request from "@/utils/request.js";

// ✅ 查询店铺营业状态（对应后端 GET /admin/shop/status）
// 后端把状态存在 Redis 里（可以理解成一个"开关盒子"，存了就不会因重启丢掉）
// 返回 data 是一个数字：1 = 营业中，0 = 打烊中
// ⚠️ 如果后端 Redis 里还没存过状态（第一次启动就进页面），会返回 code=0 + 提示"店铺状态获取失败"，
//    页面要按失败处理（弹提示、保持默认显示），不能当成"打烊"去改状态
export const getShopStatusApi = () => request.get('/shop/status')

// ✅ 修改店铺营业状态（对应后端 PUT /admin/shop/{status}）
// status：1 = 开店，0 = 打烊。数字直接拼在路径最后面，不需要请求体（和分类/菜品状态切换接口同一套路）
// 成功后后端返回 code=1，页面再把新状态更新到顶栏标签
export const setShopStatusApi = (status) => request.put(`/shop/${status}`)
