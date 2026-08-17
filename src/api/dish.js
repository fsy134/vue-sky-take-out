// ===== 菜品管理接口文件 =====
// 所有请求统一走 src/utils/request.js 封装好的 request（自动带 token、自动处理 401）
import request from "@/utils/request.js";

// ✅ 分页查询菜品
// name：菜品名称（模糊查询，可为空）
// categoryId：菜品分类 id（可为空，空=查全部）
// status：售卖状态（1=启售，0=停售；可为空，空=查全部）
// ⚠️ 注意两点（都是分类页踩过的坑，写在这里防止再犯）：
//   1. 空参数一律传 null，axios 会自动把 null 参数从地址里去掉，后端才不会报"接口调用失败"
//   2. 停售的值是 0！而 0 在 JS 里会被当成"假值"，所以这里不能用 `status || null` 这种写法
//     （那会把 0 错扔成 null，等于永远查不到停售的菜）
export const dishPageApi = (name, categoryId, status, page, pageSize) =>
  request.get('/dish/page', {
    params: {
      name: name || null,
      categoryId: categoryId === '' ? null : categoryId,   // ✅ 空串才扔，其余原样保留
      status: status === '' ? null : status,                 // ✅ 空串才扔，0（停售）必须原样保留
      page,
      pageSize
    }
  })

// ✅ 查询菜品分类列表（查询栏和弹窗的两个分类下拉框都用它）
// type=1 表示只查"菜品分类"（菜品只能属于菜品分类，不能选套餐分类）
// 说明：按接口归属它本该放在 category.js 里，但"一次一组件"规矩只允许动菜品页自己的文件，
//       所以先放这里，以后有需要再挪回 category.js
export const categoryListApi = (type) => request.get(`/category/list?type=${type}`)

// ✅ 新增菜品（请求体带菜品的全部字段）
export const insertDishApi = (data) => request.post('/dish', data)

// ✅ 修改菜品（请求体带 id + 全部字段）
export const editDishApi = (data) => request.put('/dish', data)

// ✅ 删除菜品：一个接口同时支持"删一个"和"批量删"
// ids 用英文逗号隔开，如 "5"（删一个）或 "5,6,7"（批量删）
export const deleteDishApi = (ids) => request.delete(`/dish?ids=${ids}`)

// ✅ 启售 / 停售菜品：status=1 启售，0 停售
// 后端对应代码：@PostMapping("/status/{status}") + @RequestParam Long id（用户 2026-08-17 贴出核对过）
export const editDishStatusApi = (id, status) => request.post(`/dish/status/${status}?id=${id}`)

// ✅ 按 id 查询菜品详情（修改回显用）
// 注意：分页列表接口返回的数据里没有"口味配置"字段，详情接口才返回完整数据（含 flavors 口味数组）
export const searchDishByIdApi = (id) => request.get(`/dish/${id}`)
