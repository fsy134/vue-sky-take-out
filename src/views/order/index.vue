<script setup>
// ===== 订单管理页面：订单种类选栏（带小红球数量）+ 条件查询 + 分页表格 + 查看/取消 =====
// 页面骨架参照套餐/菜品管理页的 CRUD 模板；选栏和"每个选栏一张不同表格"是订单页特有的
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { orderPageApi, searchOrderDetailApi, cancelOrderApi } from '@/api/order.js'

// ---------- 订单种类选栏 ----------
// ✅ 四个选栏（用户 2026-08-18 拍板）：
//   status 字段是传给后端的查询条件：''=查全部（全部订单），1=待付款（已下单），5=已完成，6=已取消
//   count 是小红球里的数字：该种类订单的总数量（页面加载时逐个查出来）
const TYPE_TABS = [
  { label: '全部订单', status: '', count: 0 },
  { label: '已下单', status: 1, count: 0 },
  { label: '已完成', status: 5, count: 0 },
  { label: '已取消', status: 6, count: 0 }
]
const activeTab = ref(0)   // 当前选中第几个选栏（0=全部订单，1=已下单...）

// ✅ 订单状态编号 → 中文名 + 标签颜色对照表
// 编号是后端数据库里存的值（见后端 Orders 类的注释：1待付款 2待接单 3已接单 4派送中 5已完成 6已取消 7退款）
// type 用的是 Element Plus 自带的标签颜色（warning 橙/success 绿/info 灰/primary 蓝/danger 红），不算硬编码颜色
const statusMap = {
  1: { text: '待付款', type: 'warning' },
  2: { text: '待接单', type: 'warning' },
  3: { text: '已接单', type: 'primary' },
  4: { text: '派送中', type: 'primary' },
  5: { text: '已完成', type: 'success' },
  6: { text: '已取消', type: 'info' },
  7: { text: '退款', type: 'danger' }
}

// ✅ 支付状态编号 → 中文名（订单详情弹窗里显示用）
const payStatusMap = { 0: '未支付', 1: '已支付', 2: '退款' }

// ---------- 分页参数 ----------
const currentPage = ref(1)   // 当前页码
const pageSize = ref(10)     // 每页显示条数
const total = ref(0)         // 总条数

// ---------- 查询条件 ----------
const searchNumber = ref('')         // 订单号（模糊查询）
const searchPhone = ref('')          // 手机号（模糊查询）
const searchTimeRange = ref([])      // 下单时间范围：[开始时间, 结束时间]，用日期范围选择器填

// ---------- 表格数据 ----------
const orderList = ref([])

// ---------- 小红球数量 ----------
// ✅ 只有"已下单"选栏有小红球（用户 2026-08-18 拍板），所以只需查这一个状态的订单数量：
//    用"已下单"的状态（1=待付款）查一次"第 1 页、每页 1 条"，只取 total 总条数不拉数据
// ⚠️ 后端本来有个"各状态数量统计"接口（GET /order/statistics），但它的字段全被注释掉了返回空壳，
//    所以只能这样查总数（1 次轻量查询，对教学项目完全没有压力）
const loadCounts = async () => {
  const tab = TYPE_TABS[1]   // ✅ 第 2 个选栏 = 已下单
  const result = await orderPageApi('', '', tab.status, '', '', 1, 1)
  if (result.code === 1) {
    tab.count = result.data.total   // ✅ total 就是已下单订单的总数量
  }
}

// ---------- 分页查询 ----------
const search = async () => {
  // ✅ 当前选中的选栏决定查哪个状态的订单
  const tab = TYPE_TABS[activeTab.value]
  const result = await orderPageApi(
    searchNumber.value,
    searchPhone.value,
    tab.status,
    searchTimeRange.value?.[0] || '',   // ✅ 时间范围的第 1 个是开始时间
    searchTimeRange.value?.[1] || '',   // ✅ 第 2 个是结束时间
    currentPage.value,
    pageSize.value
  )
  if (result.code === 1) {
    // ✅ 后端返回 { records: 当前页数据, total: 总条数 }
    orderList.value = result.data.records
    total.value = result.data.total
  }
}

// ✅ 点击查询按钮：先把页码重置回第 1 页再查
const handleQuery = () => {
  currentPage.value = 1
  search()
}

// ✅ 切换选栏：换当前选中项、回到第 1 页、按新选栏的状态重新查
const switchTab = (index) => {
  activeTab.value = index
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

// ---------- 查看订单详情 ----------
const detailDialogVisible = ref(false)   // 详情弹窗是否显示
const orderDetail = ref({})              // 详情数据（含 orderDetailList 订单明细数组）

// ✅ 打开详情弹窗：表格行数据里没有菜品明细，要调详情接口（GET /order/details/{id}）现查
const openDetailDialog = async (row) => {
  const result = await searchOrderDetailApi(row.id)
  if (result.code === 1) {
    orderDetail.value = result.data
    detailDialogVisible.value = true
  } else {
    ElMessage.error(result.msg || '查询订单详情失败')
  }
}

// ---------- 取消订单 ----------
const cancelDialogVisible = ref(false)   // 取消弹窗是否显示
const cancelOrderId = ref('')            // 要取消的订单 id
const cancelReason = ref('')             // 取消原因（必填）

// ✅ 打开取消弹窗：记住订单 id，清空上一次填的原因
const openCancelDialog = (row) => {
  cancelOrderId.value = row.id
  cancelReason.value = ''
  cancelDialogVisible.value = true
}

// ✅ 确定取消：取消原因必填，成功后再刷新表格和小红球数量
const handleCancelConfirm = async () => {
  // 去掉首尾空格后还是空的 = 没填原因，提醒并拦住
  if (!cancelReason.value.trim()) {
    ElMessage.warning('请输入取消原因')
    return
  }
  const result = await cancelOrderApi(cancelOrderId.value, cancelReason.value)
  if (result.code === 1) {
    ElMessage.success('取消成功')
    cancelDialogVisible.value = false
    search()        // ✅ 刷新表格
    loadCounts()    // ✅ 取消订单后已下单数量可能变了，小红球要重新算
  } else {
    ElMessage.error(result.msg)
  }
}

// ✅ 页面加载完成后：查一次表格 + 算出"已下单"小红球的订单数量
onMounted(() => {
  search()
  loadCounts()
})
</script>

<template>
  <!-- ===== 订单种类选栏（用户拍板：选中项填充黄色；只有"已下单"选栏文字右上角有小红球显示数量） ===== -->
  <div class="type-bar">
    <div
      v-for="(tab, index) in TYPE_TABS"
      :key="tab.label"
      class="type-item"
      :class="{ 'type-item-active': activeTab === index }"
      @click="switchTab(index)"
    >
      {{ tab.label }}
      <!-- ✅ 小红球：只有"已下单"选栏（status===1）显示，且数量为 0 时不显示（v-if 两个条件同时满足才渲染）
           颜色 #ff0000 见 CLAUDE.md 7.1 表 -->
      <span v-if="tab.status === 1 && tab.count > 0" class="count-badge">{{ tab.count }}</span>
    </div>
  </div>

  <!-- ===== 查询栏：订单号 + 手机号 + 下单时间范围 + 查询按钮 ===== -->
  <div class="top-bar">
    <div class="left-group">
      <span class="label">订单号：</span>
      <el-input v-model="searchNumber" placeholder="请输入订单号" clearable style="width: 200px" />

      <span class="label">手机号：</span>
      <el-input v-model="searchPhone" placeholder="请输入手机号" clearable style="width: 180px" />

      <span class="label">下单时间：</span>
      <!-- ✅ 日期范围选择器：同时选开始和结束时间
           type="datetimerange" 表示选到时分秒；value-format 把选好的值格式化成后端要求的 "yyyy-MM-dd HH:mm:ss" -->
      <el-date-picker
        v-model="searchTimeRange"
        type="datetimerange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="width: 360px"
      />

      <el-button class="btn-black" @click="handleQuery">查询</el-button>
    </div>
  </div>

  <!-- ===== 订单列表表格 ===== -->
  <!-- ✅ 同一个表格，列会根据选中的选栏自动增减（用 v-if 控制） -->
  <el-table
    :data="orderList"
    stripe
    style="width: 100%; margin-top: 20px; margin-bottom: 20px;"
    :row-style="{ height: '50px' }"
  >
    <!-- ✅ 以下四列是四个选栏共有的 -->
    <el-table-column prop="number" label="订单号" min-width="170" align="center" />

    <!-- ✅ 订单状态列：只有"全部订单"选栏有 -->
    <el-table-column v-if="TYPE_TABS[activeTab].status === ''" label="订单状态" min-width="100" align="center">
      <template #default="scope">
        <!-- ✅ 用状态编号查对照表显示中文名 + 对应颜色的标签 -->
        <el-tag :type="statusMap[scope.row.status]?.type || 'info'">
          {{ statusMap[scope.row.status]?.text || '未知' }}
        </el-tag>
      </template>
    </el-table-column>

    <el-table-column prop="userName" label="用户名" min-width="110" align="center" />

    <!-- ✅ 手机号列：已下单选栏没有（用户拍板的列设计），其余三个都有 -->
    <el-table-column v-if="TYPE_TABS[activeTab].status !== 1" prop="phone" label="手机号" min-width="130" align="center" />

    <!-- ✅ 实收金额列：只有"全部订单"和"已完成"有 -->
    <el-table-column v-if="TYPE_TABS[activeTab].status === '' || TYPE_TABS[activeTab].status === 5" label="实收金额" min-width="100" align="center">
      <template #default="scope">
        <!-- ✅ 金额用默认黑色显示（用户拍板：不要红字） -->
        <span>￥{{ scope.row.amount }}</span>
      </template>
    </el-table-column>

    <!-- ✅ 备注列：已下单和已完成有；show-overflow-tooltip=内容太长时缩成一行、鼠标悬停显示全文 -->
    <el-table-column v-if="TYPE_TABS[activeTab].status === 1 || TYPE_TABS[activeTab].status === 5" prop="remark" label="备注" min-width="140" align="center" show-overflow-tooltip />

    <!-- ✅ 下单时间列：已取消以外的三个选栏都有 -->
    <el-table-column v-if="TYPE_TABS[activeTab].status !== 6" prop="orderTime" label="下单时间" min-width="170" align="center" />

    <!-- ✅ 取消时间列：只有"已取消"选栏有 -->
    <el-table-column v-if="TYPE_TABS[activeTab].status === 6" prop="cancelTime" label="取消时间" min-width="170" align="center" />

    <!-- ✅ 取消原因列：只有"已取消"选栏有 -->
    <el-table-column v-if="TYPE_TABS[activeTab].status === 6" prop="cancelReason" label="取消原因" min-width="160" align="center" show-overflow-tooltip />

    <el-table-column label="操作" min-width="140" align="center">
      <template #default="scope">
        <!-- ✅ 取消按钮：全部订单和已完成两个选栏有；查看按钮：所有选栏都有 -->
        <el-button
          v-if="TYPE_TABS[activeTab].status === '' || TYPE_TABS[activeTab].status === 5"
          class="btn-text btn-text-red"
          size="small"
          @click="openCancelDialog(scope.row)"
        >取消</el-button>
        <el-button class="btn-text btn-text-blue" size="small" @click="openDetailDialog(scope.row)">查看</el-button>
      </template>
    </el-table-column>
  </el-table>

  <!-- ===== 分页条（和套餐页一个样式） ===== -->
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

  <!-- ===== 查看订单详情弹窗 ===== -->
  <el-dialog v-model="detailDialogVisible" title="订单详情" width="700px" align-center>
    <!-- ✅ 详情信息：每行一个"标签：内容"，直接展示后端详情接口返回的字段 -->
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">订单号：</span>{{ orderDetail.number }}</div>
      <div class="detail-row">
        <span class="detail-label">订单状态：</span>
        <el-tag :type="statusMap[orderDetail.status]?.type || 'info'">
          {{ statusMap[orderDetail.status]?.text || '未知' }}
        </el-tag>
      </div>
      <div class="detail-row"><span class="detail-label">用户名：</span>{{ orderDetail.userName }}</div>
      <div class="detail-row"><span class="detail-label">手机号：</span>{{ orderDetail.phone }}</div>
      <div class="detail-row"><span class="detail-label">下单时间：</span>{{ orderDetail.orderTime }}</div>
      <div class="detail-row"><span class="detail-label">支付状态：</span>{{ payStatusMap[orderDetail.payStatus] || '未知' }}</div>
      <div class="detail-row"><span class="detail-label">实收金额：</span>￥{{ orderDetail.amount }}</div>
      <div class="detail-row"><span class="detail-label">备注：</span>{{ orderDetail.remark || '无' }}</div>
      <!-- ✅ 只有已取消的订单才有取消原因和取消时间，取消过才显示这两行 -->
      <div v-if="orderDetail.status === 6" class="detail-row"><span class="detail-label">取消时间：</span>{{ orderDetail.cancelTime }}</div>
      <div v-if="orderDetail.status === 6" class="detail-row"><span class="detail-label">取消原因：</span>{{ orderDetail.cancelReason }}</div>
    </div>

    <!-- ✅ 订单明细表格：这道订单里都有哪些菜/套餐，各点了几份 -->
    <el-table
      :data="orderDetail.orderDetailList"
      stripe
      style="width: 100%; margin-top: 15px;"
      :row-style="{ height: '50px' }"
    >
      <el-table-column label="图片" min-width="80" align="center">
        <template #default="scope">
          <el-image :src="scope.row.image" fit="cover" style="width: 50px; height: 50px; border-radius: 6px;">
            <template #error>
              <div class="img-placeholder">暂无图</div>
            </template>
          </el-image>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="140" align="center" />
      <el-table-column prop="dishFlavor" label="口味" min-width="120" align="center" show-overflow-tooltip />
      <el-table-column prop="number" label="数量" min-width="70" align="center" />
      <el-table-column label="金额" min-width="100" align="center">
        <template #default="scope">
          <span>￥{{ scope.row.amount }}</span>
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <div style="display: flex; justify-content: center;">
        <el-button class="btn-black" @click="detailDialogVisible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- ===== 取消订单弹窗 ===== -->
  <el-dialog v-model="cancelDialogVisible" title="取消订单" width="420px" align-center>
    <el-form label-width="90px">
      <el-form-item label="取消原因">
        <!-- ✅ 多行文本框填写取消原因，后端会把它存进这条订单的"取消原因"字段 -->
        <el-input
          v-model="cancelReason"
          type="textarea"
          :rows="3"
          placeholder="请输入取消原因（必填，如：菜品售罄、用户要求取消）"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div style="display: flex; justify-content: center; gap: 12px;">
        <el-button @click="cancelDialogVisible = false">取消</el-button>
        <el-button class="btn-black" @click="handleCancelConfirm">确定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* ===== 订单种类选栏：一排可点击的"胶囊"，选中的填黄色 ===== */
.type-bar {
  display: flex;
  gap: 30px;                 /* ✅ 每个选栏之间的间距 */
  margin-bottom: 20px;
}

.type-item {
  position: relative;        /* ✅ 相对定位：让小红球能相对它做绝对定位钉在右上角 */
  padding: 8px 24px;
  font-size: 16px;
  font-family: "微软雅黑";
  color: #333;               /* 未选中：深灰字（色值见 CLAUDE.md 7.1 表） */
  border-radius: 8px;        /* 圆角（CLAUDE.md 7.1 表：tag/胶囊 8px） */
  cursor: pointer;           /* 鼠标移上去变成小手，提示可点击 */
  transition: background-color 0.2s ease;   /* ✅ 选中/取消选中时背景色平滑过渡 */
}

/* 未选中时鼠标悬停：淡黄提示 */
.type-item:hover {
  background-color: #ffe185;   /* 辅助黄（色值见 CLAUDE.md 7.1 表） */
}

/* ✅ 选中的选栏：金黄填充 + 黑字（用户拍板：选中的订单类型填充黄色） */
.type-item-active {
  background-color: #ffc100;   /* 品牌主色金黄（色值见 CLAUDE.md 7.1 表） */
  color: #000000;
}

/* ===== 小红球：显示该种类订单的数量，钉在选栏文字右上角 ===== */
.count-badge {
  position: absolute;
  top: -8px;                 /* ✅ 往上伸出一半，挂在选栏外上角 */
  right: -14px;              /* ✅ 往右伸出，钉在文字右上角 */
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background-color: #ff0000;   /* 深红（色值见 CLAUDE.md 7.1 表：危险/营业中） */
  color: #ffffff;
  font-size: 11px;
  line-height: 18px;         /* ✅ 行高=高度，数字垂直居中 */
  text-align: center;
  border-radius: 50%;        /* ✅ 圆角 50% = 正圆 */
}

/* ===== 查询栏 ===== */
.top-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;           /* 窗口变窄时自动换行 */
  gap: 12px;
}

.left-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 查询区的文字标签 */
.label {
  font-size: 16px;
  font-family: "微软雅黑";
  color: #333;               /* 色值见 CLAUDE.md 7.1 表 */
  white-space: nowrap;       /* 防止文字换行 */
}

/* ===== 黑底白字按钮（查询、弹窗确定等操作按钮，用户拍板风格） ===== */
.btn-black {
  background-color: #000 !important;
  color: #ffffff !important;
  border: none !important;
  padding: 8px 20px;
  border-radius: 6px;
}

.btn-black:hover {
  background-color: #333 !important;   /* 悬停变深灰 */
  color: #ffffff !important;
}

/* ===== 操作列文字按钮：无底色纯文字 ===== */
.btn-text {
  border: none !important;
  background: transparent !important;
  padding: 0 8px !important;
}

.btn-text-blue {
  color: #409eff !important;   /* 查看：蓝字（色值见 CLAUDE.md 7.1 表） */
}

.btn-text-red {
  color: #f56c6c !important;   /* 取消：红字（色值见 CLAUDE.md 7.1 表） */
}

/* ===== 详情弹窗的信息区：每行一个"标签：内容" ===== */
.detail-box {
  padding: 0 30px;
}

.detail-row {
  font-size: 14px;
  font-family: "微软雅黑";
  color: #333;
  margin-bottom: 10px;
}

.detail-label {
  color: #bebcbc;   /* 标签名用灰色（色值见 CLAUDE.md 7.1 表：停用/禁用），和内容区分开 */
  margin-right: 4px;
}

/* ===== 图片占位块：图片没填或失效时显示 ===== */
.img-placeholder {
  width: 50px;
  height: 50px;
  background-color: #f3f4f7;   /* 页面底色当浅灰背景（色值见 CLAUDE.md 7.1 表） */
  color: #bebcbc;              /* 禁用灰当文字色 */
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
