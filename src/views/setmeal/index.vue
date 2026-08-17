<script setup>
// ===== 套餐管理页面：套餐分页查询 + 新增/修改/删除（含批量删除）+ 启售/停售 =====
// 页面骨架参照菜品管理页（src/views/dish/index.vue）的 CRUD 标准模板
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { setmealPageApi, categoryListApi, dishListApi, insertSetmealApi, editSetmealApi, deleteSetmealApi, editSetmealStatusApi, searchSetmealByIdApi } from '@/api/setmeal.js'

// ---------- 分页参数 ----------
const currentPage = ref(1)   // 当前页码
const pageSize = ref(10)     // 每页显示条数
const total = ref(0)         // 总条数

// ---------- 查询条件 ----------
const searchName = ref('')          // 套餐名称（模糊查询）
const searchCategoryId = ref('')    // 套餐分类 id（空=查全部）
const searchStatus = ref('')        // 售卖状态：1=启售 0=停售（空=查全部）

// ---------- 表格数据 ----------
const setmealList = ref([])

// ---------- 套餐分类下拉数据 ----------
// ✅ 查询栏和弹窗的两个套餐分类下拉框共用一份分类列表（type=2 = 套餐分类）
const categoryList = ref([])
// ✅ 分类 id → 分类名称 的对照表（如 { 3: "人气套餐", 4: "商务套餐" }）
// 表格里后端返回的是 categoryId（数字），要用它查出中文名显示
const categoryNameMap = ref({})

const loadCategoryList = async () => {
  const result = await categoryListApi(2)   // ✅ 2=只查套餐分类
  if (result.code === 1) {
    categoryList.value = result.data
    // ✅ 把数组 [{id,name,...},...] 转成对照表 {id: name}，显示分类名时直接查表
    const map = {}
    result.data.forEach((item) => { map[item.id] = item.name })
    categoryNameMap.value = map
  }
}

// ---------- 图片上传 ----------
// ✅ el-upload 走自己的上传逻辑（不是 axios 封装），所以要手动给它带 token
// token 存在浏览器 localStorage 的 userInfo 里，和 request.js 的取法一致
const uploadHeaders = { token: JSON.parse(localStorage.getItem('userInfo'))?.token }

// ✅ 图片上传成功：后端返回 { code: 1, data: 图片地址 }（图片实际存到阿里云 OSS，返回完整网址）
const handleUploadSuccess = (response) => {
  if (response.code === 1) {
    setmealForm.value.image = response.data   // ✅ 把图片地址存进表单，同时上传框会显示预览图
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error(response.msg || '图片上传失败')
  }
}

// ✅ 图片上传失败（网络问题或后端报错）回调
const handleUploadError = () => {
  ElMessage.error('图片上传失败，请重试')
}

// ---------- 批量删除 ----------
const multipleSelection = ref([])   // 当前勾选中的套餐行集合

// ✅ el-table 的勾选变化事件：每次勾选/取消勾选都会触发，把最新勾选结果存下来
const handleSelectionChange = (rows) => {
  multipleSelection.value = rows
}

// ---------- 分页查询 ----------
const search = async () => {
  const result = await setmealPageApi(searchName.value, searchCategoryId.value, searchStatus.value, currentPage.value, pageSize.value)
  if (result.code) {
    // ✅ 后端返回 { records: 当前页数据, total: 总条数 }
    setmealList.value = result.data.records
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

// ---------- 对话框 ----------
const dialogFormVisible = ref(false)  // 对话框是否显示
const dialogTitle = ref('')           // 对话框标题
const isEdit = ref(false)             // ✅ 标记：true=修改模式，false=新增模式
const formRef = ref(null)             // 表单引用（提交前做校验用）

// 套餐表单对象：新增和修改共用一个
const setmealForm = ref({
  id: '',            // 套餐 id（修改时才有值）
  name: '',          // 套餐名称
  categoryId: '',    // 所属套餐分类 id
  price: '',         // 售价（字符串，提交时再转数字）
  image: '',         // 套餐图片地址
  description: '',   // 套餐描述（可不填）
  status: 1,         // 售卖状态：1=启售 0=停售（新增默认启售）
  setmealDishes: []  // 套餐包含的菜品列表（每项 = { dishId: 菜品id, name: 菜品名, price: 原价, copies: 份数 }）
})

// ---------- 表单校验规则 ----------
const formRules = {
  // 套餐名称：必填
  name: [
    { required: true, message: '请输入套餐名称', trigger: 'blur' }
  ],
  // 套餐分类：必选
  categoryId: [
    { required: true, message: '请选择套餐分类', trigger: 'change' }
  ],
  // 售价：必填 + 必须是正数、最多两位小数
  price: [
    { required: true, message: '请输入售价', trigger: 'blur' },
    // ✅ 正则分两段理解：(?!0(\.0{1,2})?$) 是"排除 0 / 0.0 / 0.00"，
    //    后面的 \d+(\.\d{1,2})? 是"整数开头，最多带两位小数"
    { pattern: /^(?!0(\.0{1,2})?$)\d+(\.\d{1,2})?$/, message: '售价需为正数，最多两位小数', trigger: 'blur' }
  ]
}

// ---------- 新增 ----------
const openAddDialog = () => {
  isEdit.value = false
  dialogTitle.value = '新增套餐'
  setmealForm.value = { id: '', name: '', categoryId: '', price: '', image: '', description: '', status: 1, setmealDishes: [] }
  dialogFormVisible.value = true
}

// ---------- 修改（先查详情接口再回显：表格行数据里没有"套餐菜品"字段） ----------
const openEditDialog = async (row) => {
  // ✅ 分页列表接口返回的数据没有套餐菜品 setmealDishes 字段，详情接口（GET /setmeal/{id}）才返回完整数据
  const result = await searchSetmealByIdApi(row.id)
  if (result.code !== 1) {
    ElMessage.error(result.msg || '查询套餐详情失败')
    return
  }
  const detail = result.data
  isEdit.value = true
  dialogTitle.value = '修改套餐'
  // ✅ 把详情数据拷进表单对象（用拷贝而不是直接赋值，避免表格跟着表单一起变）
  setmealForm.value = {
    id: detail.id,
    name: detail.name,
    categoryId: detail.categoryId,
    price: String(detail.price),   // ✅ 价格转成字符串放进输入框（输入框里只存字符串）
    image: detail.image,
    description: detail.description,
    status: detail.status,
    // ✅ 详情里的套餐菜品是 [{ dishId, name, price, copies }, ...]，原样拷进表单供表格显示
    setmealDishes: (detail.setmealDishes || []).map((d) => ({
      dishId: d.dishId,
      name: d.name,
      price: d.price,
      copies: d.copies
    }))
  }
  dialogFormVisible.value = true
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
    // ✅ 组装提交数据：售价在表单里是字符串，提交前转成数字（Number('88.5') = 88.5）
    const submitData = {
      id: setmealForm.value.id,
      name: setmealForm.value.name,
      categoryId: setmealForm.value.categoryId,
      price: Number(setmealForm.value.price),
      image: setmealForm.value.image,
      description: setmealForm.value.description,
      status: setmealForm.value.status,
      // ✅ 套餐菜品直接原样提交（后端要的字段就是 dishId/name/price/copies，见后端 SetmealDish 类）
      setmealDishes: setmealForm.value.setmealDishes.map((d) => ({
        dishId: d.dishId,
        name: d.name,
        price: d.price,
        copies: d.copies
      }))
    }
    // 新增走新增接口，修改走修改接口
    const result = isEdit.value ? await editSetmealApi(submitData) : await insertSetmealApi(submitData)
    if (result.code === 1) {
      ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
      dialogFormVisible.value = false
      search()   // ✅ 刷新表格
    } else {
      ElMessage.error(result.msg)   // 失败弹后端返回的原因（如：套餐名称已存在）
    }
  })
}

// ---------- 删除单个套餐（先弹确认框，防止误删） ----------
const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除套餐"${row.name}"吗？删除后不可恢复！`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    // ✅ 单个删除也走批量接口：只传一个 id（如 "5"）
    const result = await deleteSetmealApi(String(row.id))
    if (result.code === 1) {
      ElMessage.success('删除成功')
      search()
    } else {
      ElMessage.error(result.msg)   // 如：启售中的套餐不能删除，后端会拒绝并返回原因
    }
  }).catch(() => {
    // ✅ 用户点了取消：什么都不做（catch 必须写，否则浏览器控制台会报"未处理的 Promise 拒绝"）
  })
}

// ---------- 批量删除（勾选多行后一次删掉） ----------
const handleBatchDelete = () => {
  // ✅ 先检查有没有勾选，没勾选就提醒，不发请求
  if (multipleSelection.value.length === 0) {
    ElMessage.warning('请先勾选要删除的套餐')
    return
  }
  // ✅ 把勾选行的 id 收集起来，用英文逗号拼成 "1,2,3" 形式，一次请求全删
  const ids = multipleSelection.value.map((row) => row.id).join(',')
  ElMessageBox.confirm(`确定要删除选中的 ${multipleSelection.value.length} 个套餐吗？删除后不可恢复！`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    const result = await deleteSetmealApi(ids)
    if (result.code === 1) {
      ElMessage.success('删除成功')
      search()
    } else {
      ElMessage.error(result.msg)
    }
  }).catch(() => {
    // ✅ 用户点了取消：什么都不做
  })
}

// ---------- 启售 / 停售套餐 ----------
const editSetmealStatus = async (id, status) => {
  const action = status === 1 ? '启售' : '停售'
  const result = await editSetmealStatusApi(id, status)
  if (result.code === 1) {
    ElMessage.success(`${action}成功`)
    search()
  } else {
    ElMessage.error(result.msg)   // 如：套餐里有停售的菜，后端会拒绝启售并返回原因
  }
}

// ---------- 对话框关闭后：清空表单和校验状态 ----------
const handleDialogClosed = () => {
  setmealForm.value = { id: '', name: '', categoryId: '', price: '', image: '', description: '', status: 1, setmealDishes: [] }
  formRef.value?.resetFields()   // ✅ 清掉校验红字
}

// ---------- "添加菜品"弹窗（套餐弹窗里套的第二层弹窗） ----------
const dishDialogVisible = ref(false)   // 选菜品弹窗是否显示
const dishCategoryList = ref([])       // 菜品分类列表（type=1，选菜品时按分类筛选）
const dishCategoryId = ref('')         // 当前选中的菜品分类 id
const dishOptions = ref([])            // 当前分类下的菜品列表（每项带 copies 份数字段）
const dishSelection = ref([])          // 弹窗表格里勾选中的菜品行
const dishCheckTableRef = ref(null)    // 菜品勾选表格引用（清勾选用）

// ✅ 加载菜品分类列表（type=1 = 菜品分类，和套餐分类 type=2 区分开）
const loadDishCategoryList = async () => {
  const result = await categoryListApi(1)
  if (result.code === 1) {
    dishCategoryList.value = result.data
  }
}

// ✅ 打开选菜品弹窗：每次打开都清空上一次的勾选和菜品列表
const openDishDialog = () => {
  dishCategoryId.value = ''
  dishOptions.value = []
  dishSelection.value = []
  dishCheckTableRef.value?.clearSelection()
  dishDialogVisible.value = true
}

// ✅ 选中某个菜品分类后：按分类查菜品列表（GET /dish/list?categoryId=xx）
const handleDishCategoryChange = async () => {
  const result = await dishListApi(dishCategoryId.value)
  if (result.code === 1) {
    // ✅ 每道菜补一个 copies=1 的份数字段，勾选后可在表格里改份数
    dishOptions.value = result.data.map((d) => ({ ...d, copies: 1 }))
    dishCheckTableRef.value?.clearSelection()   // 换分类后清掉之前的勾选
  }
}

// ✅ 勾选变化事件：把最新勾选结果存下来
const handleDishSelectChange = (rows) => {
  dishSelection.value = rows
}

// ✅ 确定添加：把勾选中的菜品加进套餐表单的套餐菜品表格
const confirmAddDishes = () => {
  // 先检查有没有勾选，没勾选就提醒
  if (dishSelection.value.length === 0) {
    ElMessage.warning('请先勾选要添加的菜品')
    return
  }
  // ✅ 已经加过的菜不能重复添加：先收集表格里已有的菜品 id，再用它过滤掉重复勾选的
  const existingIds = setmealForm.value.setmealDishes.map((d) => d.dishId)
  const newDishes = dishSelection.value
    .filter((d) => !existingIds.includes(d.id))
    .map((d) => ({ dishId: d.id, name: d.name, price: d.price, copies: d.copies }))
  // ✅ 把新勾选的菜追加进套餐菜品表格
  setmealForm.value.setmealDishes.push(...newDishes)
  dishDialogVisible.value = false
}

// ✅ 从套餐里移除一道菜（只从表格里删，最终点"确定"才会真正提交）
const removeDish = (row) => {
  setmealForm.value.setmealDishes = setmealForm.value.setmealDishes.filter((d) => d.dishId !== row.dishId)
}

// ✅ 页面加载完成后：查一次表格 + 加载套餐分类（查询栏/弹窗用）和菜品分类（选菜品弹窗用）
onMounted(() => {
  search()
  loadCategoryList()
  loadDishCategoryList()
})
</script>

<template>
  <!-- ===== 顶部操作区：左边查询、右边批量删除和新增 ===== -->
  <div class="top-bar">
    <!-- 左边：查询区（名称输入框 + 分类下拉框 + 售卖状态下拉框 + 查询按钮） -->
    <div class="left-group">
      <span class="label">套餐名称：</span>
      <el-input v-model="searchName" placeholder="请输入套餐名称" clearable style="width: 200px" />

      <span class="label">套餐分类：</span>
      <el-select v-model="searchCategoryId" placeholder="请选择套餐分类" clearable style="width: 160px">
        <!-- ✅ 下拉选项就是查回来的套餐分类列表：显示的 label 是分类名，选中后存的是分类 id -->
        <el-option v-for="item in categoryList" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>

      <span class="label">售卖状态：</span>
      <el-select v-model="searchStatus" placeholder="请选择售卖状态" clearable style="width: 140px">
        <el-option label="启售" :value="1" />
        <el-option label="停售" :value="0" />
      </el-select>

      <el-button class="btn-black" @click="handleQuery">查询</el-button>
    </div>

    <!-- 右边：批量删除（红色无框文字按钮）+ 新增套餐 -->
    <div class="right-group">
      <el-button class="btn-text btn-text-red" @click="handleBatchDelete">批量删除</el-button>
      <el-button class="btn-black" @click="openAddDialog">+ 新增套餐</el-button>
    </div>
  </div>

  <!-- ===== 套餐列表表格 ===== -->
  <!-- ✅ @selection-change 监听勾选变化，勾选的行存进 multipleSelection 供批量删除用 -->
  <el-table
    :data="setmealList"
    stripe
    style="width: 100%; margin-top: 20px; margin-bottom: 20px;"
    :row-style="{ height: '50px' }"
    @selection-change="handleSelectionChange"
  >
    <!-- ✅ type="selection" 就是最左边的方框勾选列 -->
    <el-table-column type="selection" width="50" align="center" />

    <el-table-column prop="name" label="套餐名称" min-width="140" align="center" />

    <el-table-column label="图片" min-width="100" align="center">
      <template #default="scope">
        <!-- ✅ 套餐图片缩略图：cover 表示"填满方框、裁掉多余部分" -->
        <el-image :src="scope.row.image" fit="cover" style="width: 50px; height: 50px; border-radius: 6px;">
          <template #error>
            <!-- ✅ 图片没填或地址失效时，显示一个灰底占位块，避免难看的破图图标 -->
            <div class="img-placeholder">暂无图</div>
          </template>
        </el-image>
      </template>
    </el-table-column>

    <el-table-column label="套餐分类" min-width="120" align="center">
      <template #default="scope">
        <!-- ✅ 优先用后端直接给的中文名 categoryName；没给就用本地对照表按 id 翻译 -->
        <span>{{ scope.row.categoryName || categoryNameMap[scope.row.categoryId] }}</span>
      </template>
    </el-table-column>

    <el-table-column label="售价" min-width="100" align="center">
      <template #default="scope">
        <!-- ✅ 价格用默认黑色显示（用户拍板：不要红字） -->
        <span>￥{{ scope.row.price }}</span>
      </template>
    </el-table-column>

    <el-table-column label="售卖状态" min-width="120" align="center">
      <template #default="scope">
        <!-- ✅ 状态小圆点 + 文字（和菜品页一个样式：绿=启售 灰=停售） -->
        <span class="dot" :class="scope.row.status === 1 ? 'dot-green' : 'dot-grey'" />
        {{ scope.row.status === 1 ? '启售' : '停售' }}
      </template>
    </el-table-column>

    <el-table-column prop="updateTime" label="最后操作时间" min-width="180" align="center" />

    <el-table-column label="操作" min-width="200" align="center">
      <template #default="scope">
        <!-- ✅ 操作列统一"无底色文字按钮"：修改=蓝字，删除=红字，停售=红字，启售=绿字 -->
        <el-button class="btn-text btn-text-blue" size="small" @click="openEditDialog(scope.row)">修改</el-button>
        <el-button class="btn-text btn-text-red" size="small" @click="handleDelete(scope.row)">删除</el-button>
        <!-- ✅ 启售状态显示"停售"按钮，停售状态显示"启售"按钮（和菜品页一个思路） -->
        <span v-if="scope.row.status === 1">
          <el-button class="btn-text btn-text-red" size="small" @click="editSetmealStatus(scope.row.id, 0)">停售</el-button>
        </span>
        <span v-if="scope.row.status === 0">
          <el-button class="btn-text btn-text-green" size="small" @click="editSetmealStatus(scope.row.id, 1)">启售</el-button>
        </span>
      </template>
    </el-table-column>
  </el-table>

  <!-- ===== 分页条（和菜品页一个样式） ===== -->
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

  <!-- ===== 新增/修改套餐对话框 ===== -->
  <el-dialog
    v-model="dialogFormVisible"
    :title="dialogTitle"
    width="700px"
    align-center
    @closed="handleDialogClosed"
  >
    <el-form ref="formRef" :model="setmealForm" :rules="formRules" label-width="90px" style="padding-left: 40px;">
      <el-form-item label="套餐名称" prop="name">
        <el-input v-model="setmealForm.name" placeholder="请输入套餐名称" style="width: 300px" />
      </el-form-item>

      <el-form-item label="套餐分类" prop="categoryId">
        <el-select v-model="setmealForm.categoryId" placeholder="请选择套餐分类" style="width: 300px">
          <el-option v-for="item in categoryList" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="售价" prop="price">
        <!-- ✅ 输入框前面固定一个 ￥ 符号，用户只填数字 -->
        <el-input v-model="setmealForm.price" placeholder="请输入售价（元）" style="width: 300px">
          <template #prefix>￥</template>
        </el-input>
      </el-form-item>

      <el-form-item label="套餐图片" prop="image">
        <!-- ✅ 图片上传：点方框从电脑选本地图片，自动上传到后端（POST /common/upload，图片存阿里云 OSS） -->
        <el-upload
          class="setmeal-uploader"
          action="/api/common/upload"
          :headers="uploadHeaders"
          name="file"
          :show-file-list="false"
          accept="image/*"
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
        >
          <!-- ✅ 已有图片就显示预览图（点击可重新上传），没有就显示上传提示 -->
          <img v-if="setmealForm.image" :src="setmealForm.image" class="setmeal-uploader-img" />
          <div v-else class="setmeal-uploader-empty">+ 上传图片</div>
        </el-upload>
        <span class="upload-tip">支持 jpg / png，点击图片可重新上传</span>
      </el-form-item>

      <!-- ✅ 套餐菜品：点"添加菜品"打开选菜品弹窗，选好的菜显示在下面的小表格里 -->
      <el-form-item label="套餐菜品">
        <div>
          <el-button class="btn-black" size="small" @click="openDishDialog">+ 添加菜品</el-button>
          <el-table
            :data="setmealForm.setmealDishes"
            stripe
            style="width: 480px; margin-top: 10px;"
            :row-style="{ height: '40px' }"
          >
            <el-table-column prop="name" label="菜品名称" min-width="140" align="center" />
            <el-table-column label="原价" min-width="90" align="center">
              <template #default="scope">
                <span>￥{{ scope.row.price }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="copies" label="份数" min-width="70" align="center" />
            <el-table-column label="操作" min-width="90" align="center">
              <template #default="scope">
                <el-button class="btn-text btn-text-red" size="small" @click="removeDish(scope.row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-form-item>

      <el-form-item label="描述" prop="description">
        <!-- ✅ 描述用多行文本框：rows 控制高度，最多显示 3 行 -->
        <el-input
          v-model="setmealForm.description"
          type="textarea"
          :rows="3"
          placeholder="请输入套餐描述（可不填，如套餐包含什么、适合几人食用）"
          style="width: 300px"
        />
      </el-form-item>

      <el-form-item label="售卖状态">
        <!-- ✅ 新增默认启售；:value 是选中的值（1=启售 0=停售），和菜品页写法一致 -->
        <el-radio-group v-model="setmealForm.status">
          <el-radio :value="1">启售</el-radio>
          <el-radio :value="0">停售</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <!-- ✅ 底部按钮：取消 + 确定 -->
    <template #footer>
      <div style="display: flex; justify-content: center; gap: 12px;">
        <el-button @click="dialogFormVisible = false">取消</el-button>
        <el-button class="btn-black" @click="handleSubmit">确定</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- ===== 选菜品弹窗（套在套餐弹窗里的第二层弹窗） ===== -->
  <!-- ✅ append-to-body：把弹窗挪到页面最外层显示，避免被外层弹窗挡住或挤压 -->
  <el-dialog
    v-model="dishDialogVisible"
    title="添加菜品"
    width="800px"
    align-center
    append-to-body
  >
    <!-- 顶部：先选菜品分类，表格才显示该分类下的菜 -->
    <div class="dish-picker-top">
      <span class="label">菜品分类：</span>
      <el-select v-model="dishCategoryId" placeholder="请选择菜品分类" style="width: 200px" @change="handleDishCategoryChange">
        <el-option v-for="item in dishCategoryList" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>

    <!-- ✅ 菜品勾选表格：勾选想要的菜，改好份数，点确定就加进套餐 -->
    <el-table
      ref="dishCheckTableRef"
      :data="dishOptions"
      stripe
      style="width: 100%; margin-top: 10px;"
      :row-style="{ height: '50px' }"
      @selection-change="handleDishSelectChange"
    >
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column prop="name" label="菜品名称" min-width="160" align="center" />
      <el-table-column label="原价" min-width="120" align="center">
        <template #default="scope">
          <span>￥{{ scope.row.price }}</span>
        </template>
      </el-table-column>
      <el-table-column label="份数" min-width="140" align="center">
        <template #default="scope">
          <!-- ✅ 份数最少 1 份；改完不用点保存，勾选行里的份数会跟着行一起提交 -->
          <el-input-number v-model="scope.row.copies" :min="1" size="small" style="width: 100px" />
        </template>
      </el-table-column>
    </el-table>

    <!-- ✅ 底部按钮：取消 + 确定 -->
    <template #footer>
      <div style="display: flex; justify-content: center; gap: 12px;">
        <el-button @click="dishDialogVisible = false">取消</el-button>
        <el-button class="btn-black" @click="confirmAddDishes">确定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* ===== 顶部操作区：左边查询、右边批量删除和新增，两端对齐 ===== */
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
  color: #f56c6c !important;   /* 删除/停售/批量删除：红字（色值见 CLAUDE.md 7.1 表） */
}

.btn-text-green {
  color: #67c23a !important;   /* 启售：绿字（色值见 CLAUDE.md 7.1 表） */
}

/* ===== 图片占位块：图片没填或失效时显示（色值见 CLAUDE.md 7.1 表） ===== */
.img-placeholder {
  width: 50px;
  height: 50px;
  background-color: #f3f4f7;   /* 页面底色当浅灰背景 */
  color: #bebcbc;              /* 禁用灰当文字色 */
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 图片上传框（色值见 CLAUDE.md 7.1 表） ===== */
.setmeal-uploader :deep(.el-upload) {
  border: 1px dashed #bebcbc;   /* 灰色虚线框，像"照片框" */
  border-radius: 8px;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.setmeal-uploader-img {
  width: 120px;
  height: 120px;
  object-fit: cover;   /* ✅ 图片填满方框、裁掉多余部分 */
}

.setmeal-uploader-empty {
  font-size: 14px;
  color: #bebcbc;   /* 灰色提示文字 */
}

/* 上传框旁边的小字提示 */
.upload-tip {
  font-size: 12px;
  color: #bebcbc;
  margin-left: 10px;
}

/* ===== 选菜品弹窗顶部：分类下拉框那行 ===== */
.dish-picker-top {
  display: flex;
  align-items: center;
}

/* ===== 状态小圆点（和菜品页一致） ===== */
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.dot-green {
  background-color: #67c23a;   /* 启售：绿色（色值见 CLAUDE.md 7.1 表） */
}

.dot-grey {
  background-color: #bebcbc;   /* 停售：灰色（色值见 CLAUDE.md 7.1 表） */
}
</style>
