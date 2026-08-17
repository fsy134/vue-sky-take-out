<script setup>
// ===== 分类管理页面：分类的增删改查 + 启用/禁用 =====
// 页面骨架参照员工管理页（src/views/employee/index.vue）的 CRUD 标准模板
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { categoryPageApi, insertCategoryApi, editCategoryApi, deleteCategoryApi, editCategoryStatusApi } from '@/api/category.js'

// ---------- 分页参数 ----------
const currentPage = ref(1)   // 当前页码
const pageSize = ref(10)     // 每页显示条数
const total = ref(0)         // 总条数

// ---------- 查询条件 ----------
const searchName = ref('')   // 分类名称（模糊查询）
const searchType = ref('')   // 分类类型：1=菜品分类 2=套餐分类（空=查全部）

// ---------- 表格数据 ----------
const categoryList = ref([])

// ---------- 对话框 ----------
const dialogFormVisible = ref(false)  // 对话框是否显示
const dialogTitle = ref('')           // 对话框标题
const isEdit = ref(false)             // ✅ 标记：true=修改模式，false=新增模式（决定"继续添加"按钮是否显示）
const formRef = ref(null)             // 表单引用（提交前做校验用）

// 分类表单对象：新增和修改共用一个
const categoryForm = ref({
  id: '',      // 分类 id（修改时才有值）
  name: '',    // 分类名称
  type: 1,     // 分类类型：1=菜品分类 2=套餐分类
  sort: ''     // 排序号
})

// ---------- 表单校验规则 ----------
const formRules = {
  // 分类名称：必填
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' }
  ],
  // 排序：可不填；填了必须是 0-999 的整数
  sort: [
    { pattern: /^\d{1,3}$/, message: '排序只能是 0-999 的整数', trigger: 'blur' }
  ]
}

// ---------- 分页查询 ----------
const search = async () => {
  const result = await categoryPageApi(searchName.value, searchType.value, currentPage.value, pageSize.value)
  if (result.code) {
    // ✅ 后端返回 { records: 当前页数据, total: 总条数 }
    categoryList.value = result.data.records
    total.value = result.data.total
  }
}

// ✅ 点击查询按钮：先把页码重置回第 1 页再查（防止停在后面几页时查到空表格）
const handleQuery = () => {
  currentPage.value = 1
  search()
}

// ✅ 每页条数改变：回到第 1 页重新查
const handleSizeChange = () => {
  currentPage.value = 1
  search()
}

// ✅ 页码改变：直接查新页
const handleCurrentChange = () => {
  search()
}

// ---------- 新增 ----------
// ✅ 点击"新增菜品分类"传 type=1，点击"新增套餐分类"传 type=2（类型由按钮决定，弹窗里不可改）
const openAddDialog = (type) => {
  isEdit.value = false
  dialogFormVisible.value = true
  dialogTitle.value = type === 1 ? '新增菜品分类' : '新增套餐分类'
  categoryForm.value = { id: '', name: '', type: type, sort: '' }
}

// ---------- 修改（直接用表格行的数据回显，不用再查接口） ----------
const openEditDialog = (row) => {
  isEdit.value = true
  dialogFormVisible.value = true
  dialogTitle.value = '修改分类'
  // ✅ 把表格行的数据拷进表单对象（用拷贝而不是直接赋值 row，避免表格跟着表单一起变）
  categoryForm.value = { id: row.id, name: row.name, type: row.type, sort: row.sort }
}

// ---------- 确定提交（新增/修改共用） ----------
const handleSubmit = async () => {
  // ✅ formRef.value 才是 el-form 组件实例；先校验，校验通过才发请求
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error('请完善表单项')
      return
    }
    // ✅ 组装提交数据：排序为空时按 0 处理（Number('') 结果是 NaN，NaN 会被 || 当成假值转成 0）
    const submitData = {
      id: categoryForm.value.id,
      name: categoryForm.value.name,
      type: categoryForm.value.type,
      sort: Number(categoryForm.value.sort) || 0
    }
    // 新增走新增接口，修改走修改接口
    const result = isEdit.value ? await editCategoryApi(submitData) : await insertCategoryApi(submitData)
    if (result.code === 1) {
      ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
      dialogFormVisible.value = false
      search()   // ✅ 刷新表格
    } else {
      ElMessage.error(result.msg)   // 失败弹后端返回的原因（如：分类名称已存在）
    }
  })
}

// ---------- 继续添加（连续新增：提交成功后不关弹窗，清空表单接着加） ----------
const handleContinueAdd = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error('请完善表单项')
      return
    }
    const result = await insertCategoryApi({
      name: categoryForm.value.name,
      type: categoryForm.value.type,
      sort: Number(categoryForm.value.sort) || 0
    })
    if (result.code === 1) {
      ElMessage.success('新增成功')
      // ✅ 关键一步：清空表单内容（保留类型不变），弹窗不关，继续输入下一条
      categoryForm.value = { id: '', name: '', type: categoryForm.value.type, sort: '' }
      formRef.value.clearValidate()   // ✅ 清掉上一次的校验红字提示
      search()   // ✅ 弹窗开着的同时刷新下面的表格
    } else {
      ElMessage.error(result.msg)
    }
  })
}

// ---------- 删除分类（先弹确认框，防止误删） ----------
const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除分类"${row.name}"吗？删除后不可恢复！`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    const result = await deleteCategoryApi(row.id)
    if (result.code === 1) {
      ElMessage.success('删除成功')
      search()
    } else {
      ElMessage.error(result.msg)   // 如：该分类下还有菜品/套餐，后端会拒绝删除并返回原因
    }
  }).catch(() => {
    // ✅ 用户点了取消：什么都不做（catch 必须写，否则浏览器控制台会报"未处理的 Promise 拒绝"）
  })
}

// ---------- 启用 / 禁用分类 ----------
const editCategoryStatus = async (id, status) => {
  const action = status === 1 ? '启用' : '禁用'
  const result = await editCategoryStatusApi(id, status)
  if (result.code === 1) {
    ElMessage.success(`${action}成功`)
    search()
  } else {
    ElMessage.error(result.msg)
  }
}

// ---------- 对话框关闭后：清空表单和校验状态 ----------
const handleDialogClosed = () => {
  categoryForm.value = { id: '', name: '', type: 1, sort: '' }
  formRef.value?.resetFields()   // ✅ 清掉校验红字
}

// ✅ 页面加载完成后立刻查一次表格
onMounted(() => {
  search()
})
</script>

<template>
  <!-- ===== 顶部操作区：左边查询、右边新增 ===== -->
  <div class="top-bar">
    <!-- 左边：查询区（名称输入框 + 类型下拉框 + 查询按钮） -->
    <div class="left-group">
      <span class="label">分类名称：</span>
      <el-input v-model="searchName" placeholder="请输入分类名称" clearable style="width: 200px" />

      <span class="label">分类类型：</span>
      <el-select v-model="searchType" placeholder="请选择分类类型" clearable style="width: 160px">
        <el-option label="菜品分类" :value="1" />
        <el-option label="套餐分类" :value="2" />
      </el-select>

      <el-button class="btn-black" @click="handleQuery">查询</el-button>
    </div>

    <!-- 右边：新增按钮（点击哪个按钮，新增的就是哪种分类） -->
    <div class="right-group">
      <el-button class="btn-black" @click="openAddDialog(1)">+ 新增菜品分类</el-button>
      <el-button class="btn-black" @click="openAddDialog(2)">+ 新增套餐分类</el-button>
    </div>
  </div>

  <!-- ===== 分类列表表格 ===== -->
  <el-table :data="categoryList" stripe style="width: 100%; margin-top: 20px; margin-bottom: 20px;" :row-style="{ height: '50px' }">
    <el-table-column prop="name" label="分类名称" min-width="150" align="center" />
    <el-table-column label="分类类型" min-width="150" align="center">
      <template #default="scope">
        <!-- ✅ type=1 显示菜品分类，type=2 显示套餐分类 -->
        <span>{{ scope.row.type === 1 ? '菜品分类' : '套餐分类' }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="updateTime" label="操作时间" min-width="180" align="center" />
    <el-table-column prop="sort" label="排序" min-width="100" align="center" />
    <el-table-column label="状态" min-width="120" align="center">
      <template #default="scope">
        <!-- ✅ 状态小圆点 + 文字（和员工页一个样式：绿=启用 灰=禁用） -->
        <span class="dot" :class="scope.row.status === 1 ? 'dot-green' : 'dot-grey'" />
        {{ scope.row.status === 1 ? '启用' : '禁用' }}
      </template>
    </el-table-column>
    <el-table-column label="操作" min-width="200" align="center">
      <template #default="scope">
        <!-- ✅ 操作列统一"无底色文字按钮"：修改=蓝字，删除=红字，禁用=红字，启用=绿字 -->
        <el-button class="btn-text btn-text-blue" size="small" @click="openEditDialog(scope.row)">修改</el-button>
        <el-button class="btn-text btn-text-red" size="small" @click="handleDelete(scope.row)">删除</el-button>
        <!-- ✅ 启用状态显示"禁用"按钮，禁用状态显示"启用"按钮 -->
        <span v-if="scope.row.status === 1">
          <el-button class="btn-text btn-text-red" size="small" @click="editCategoryStatus(scope.row.id, 0)">禁用</el-button>
        </span>
        <span v-if="scope.row.status === 0">
          <el-button class="btn-text btn-text-green" size="small" @click="editCategoryStatus(scope.row.id, 1)">启用</el-button>
        </span>
      </template>
    </el-table-column>
  </el-table>

  <!-- ===== 分页条（和员工页一个样式） ===== -->
  <el-pagination
    v-model:current-page="currentPage"
    v-model:page-size="pageSize"
    :page-sizes="[5, 10, 20, 30, 40, 75]"
    layout="total, sizes, prev, pager, next, jumper"
    :total="total"
    background
    @size-change="handleSizeChange"
    @current-change="handleCurrentChange"
    style="justify-content: center;"
  />

  <!-- ===== 新增/修改分类对话框 ===== -->
  <el-dialog
    v-model="dialogFormVisible"
    :title="dialogTitle"
    width="500px"
    align-center
    @closed="handleDialogClosed"
  >
    <el-form ref="formRef" :model="categoryForm" :rules="formRules" label-width="90px" style="padding-left: 40px;">
      <!-- ✅ 分类类型只展示不修改：新增时由点击的按钮决定，修改时不允许变 -->
      <el-form-item label="分类类型">
        <span>{{ categoryForm.type === 1 ? '菜品分类' : '套餐分类' }}</span>
      </el-form-item>

      <el-form-item label="分类名称" prop="name">
        <el-input v-model="categoryForm.name" placeholder="请输入分类名称" style="width: 300px" />
      </el-form-item>

      <el-form-item label="排序" prop="sort">
        <el-input v-model="categoryForm.sort" placeholder="请输入排序（数字越小越靠前，可不填）" style="width: 300px" />
      </el-form-item>
    </el-form>

    <!-- ✅ 底部按钮：新增时多一个"继续添加"（连续新增不停手） -->
    <template #footer>
      <div style="display: flex; justify-content: center; gap: 12px;">
        <el-button @click="dialogFormVisible = false">取消</el-button>
        <el-button class="btn-black" @click="handleSubmit">确定</el-button>
        <el-button v-if="!isEdit" class="btn-black" @click="handleContinueAdd">继续添加</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* ===== 顶部操作区：左边查询、右边新增，两端对齐 ===== */
.top-bar {
  display: flex;
  justify-content: space-between;   /* ✅ 左右分开 */
  align-items: center;
  flex-wrap: wrap;                  /* 窗口变窄时自动换行 */
  gap: 12px;
}

.left-group,
.right-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 查询区的文字标签 */
.label {
  font-size: 16px;
  font-family: "微软雅黑";
  color: #333;                 /* 色值见 CLAUDE.md 7.1 表 */
  white-space: nowrap;         /* 防止文字换行 */
}

/* ===== 黑底白字按钮（查询、新增、弹窗确定等操作按钮，用户拍板风格） ===== */
.btn-black {
  background-color: #000 !important;
  color: #ffffff !important;
  border: none !important;
  padding: 8px 20px;
  border-radius: 6px;
}

.btn-black:hover {
  background-color: #333 !important;   /* 悬停变深灰，有按下反馈感 */
  color: #ffffff !important;
}

/* ===== 操作列文字按钮：无底色纯文字 ===== */
.btn-text {
  border: none !important;
  background: transparent !important;
  padding: 0 8px !important;
}

.btn-text-blue {
  color: #409eff !important;   /* 修改：蓝字（色值见 CLAUDE.md 7.1 表） */
}

.btn-text-red {
  color: #f56c6c !important;   /* 删除/禁用：红字（色值见 CLAUDE.md 7.1 表） */
}

.btn-text-green {
  color: #67c23a !important;   /* 启用：绿字（色值见 CLAUDE.md 7.1 表） */
}

/* ===== 状态小圆点（和员工页一致） ===== */
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.dot-green {
  background-color: #67c23a;   /* 启用：绿色（色值见 CLAUDE.md 7.1 表） */
}

.dot-grey {
  background-color: #bebcbc;   /* 禁用：灰色（色值见 CLAUDE.md 7.1 表） */
}
</style>
