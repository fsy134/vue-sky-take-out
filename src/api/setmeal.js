// ===== 套餐管理接口文件 =====
// 所有请求统一走 src/utils/request.js 封装好的 request（自动带 token、自动处理 401）
import request from "@/utils/request.js";

// ✅ 分页查询套餐
// name：套餐名称（模糊查询，可为空）
// categoryId：套餐分类 id（可为空，空=查全部）
// status：售卖状态（1=启售，0=停售；可为空，空=查全部）
// ⚠️ 注意两点（都是菜品页踩过的坑，写在这里防止再犯）：
//   1. 空参数一律传 null，axios 会自动把 null 参数从地址里去掉，后端才不会报"接口调用失败"
//   2. 停售的值是 0！而 0 在 JS 里会被当成"假值"，所以这里不能用 `status || null` 这种写法
//     （那会把 0 错扔成 null，等于永远查不到停售的套餐）
export const setmealPageApi = (name, categoryId, status, page, pageSize) =>
  request.get('/setmeal/page', {
    params: {
      name: name || null,
      categoryId: categoryId === '' ? null : categoryId,   // ✅ 空串才扔，其余原样保留
      status: status === '' ? null : status,                 // ✅ 空串才扔，0（停售）必须原样保留
      page,
      pageSize
    }
  })

// ✅ 查询套餐分类列表（type=2 = 只查套餐分类）
// 说明：按接口归属它本该放在 category.js 里，但"一次一组件"规矩只允许动套餐页自己的文件，
//       所以先放这里（菜品页的 categoryListApi 也是同样原因放在 dish.js 里）
export const categoryListApi = (type) => request.get(`/category/list?type=${type}`)

// ✅ 按分类查询菜品列表（新增/修改套餐弹窗里的"添加菜品"用，菜品分类 type=1 的列表）
// 说明：按接口归属它本该放在 dish.js 里，但"一次一组件"规矩不允许动菜品页的文件，
//       所以先放这里，以后有需要再挪回 dish.js
export const dishListApi = (categoryId) => request.get(`/dish/list?categoryId=${categoryId}`)

// ✅ 新增套餐（请求体带套餐全部字段 + setmealDishes 套餐菜品列表）
export const insertSetmealApi = (data) => request.post('/setmeal', data)

// ✅ 修改套餐（请求体带 id + 全部字段）
export const editSetmealApi = (data) => request.put('/setmeal', data)

// ✅ 删除套餐：一个接口同时支持"删一个"和"批量删"
// ids 用英文逗号隔开，如 "5"（删一个）或 "5,6,7"（批量删）
export const deleteSetmealApi = (ids) => request.delete(`/setmeal?ids=${ids}`)

// ✅ 启售 / 停售套餐：status=1 启售，0 停售
// 后端对应代码：@PostMapping("/status/{status}") + @RequestParam Long id（2026-08-17 读后端 SetmealController 核对过）
export const editSetmealStatusApi = (id, status) => request.post(`/setmeal/status/${status}?id=${id}`)

// ✅ 按 id 查询套餐详情（修改回显用）
// 注意：分页列表接口返回的数据里没有"套餐菜品"字段，详情接口（GET /setmeal/{id}）才返回
//       完整的 setmealDishes 套餐菜品数组（含每道菜的份数 copies）
export const searchSetmealByIdApi = (id) => request.get(`/setmeal/${id}`)
