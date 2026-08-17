// ===== 分类管理接口文件 =====
// 所有请求统一走 src/utils/request.js 封装好的 request（自动带 token、自动处理 401）
import request from "@/utils/request.js";

// ✅ 分页查询分类
// name：分类名称（模糊查询，可为空）
// type：分类类型（1=菜品分类，2=套餐分类；为空=查全部）
// ⚠️ 注意：name/type 为空时传 null，axios 会自动把 null 参数从地址里去掉；
//    如果直接把空串拼进地址（如 type=），后端收到空参数会报"接口调用失败"
export const categoryPageApi = (name, type, page, pageSize) =>
  request.get('/category/page', {
    params: { name: name || null, type: type || null, page, pageSize }
  })

// ✅ 新增分类
export const insertCategoryApi = (data) => request.post('/category', data)

// ✅ 修改分类
export const editCategoryApi = (data) => request.put('/category', data)

// ✅ 删除分类（按 id 删）
export const deleteCategoryApi = (id) => request.delete(`/category?id=${id}`)

// ✅ 启用 / 禁用分类：status=1启用 0禁用
export const editCategoryStatusApi = (id, status) => request.post(`/category/status/${status}?id=${id}`)
