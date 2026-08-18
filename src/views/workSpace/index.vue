<script setup>
// ===== 工作台页面：全店运营数据的"总控面板"（四个段落，聚合各管理页入口） =====
// 数据策略（用户拍板）：不引入 Pinia，本页数据全部用 ref 自管理，和其他页面保持一致
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { businessDataApi, overviewOrdersApi, overviewDishesApi, overviewSetmealsApi } from '@/api/workspace.js'
import { orderPageApi } from '@/api/order.js' // ✅ 复用订单页接口："已下单"补算 + 第四段两张订单列表

const router = useRouter()

// ========== 一、页面数据（全部 ref 自管理） ==========

// ✅ 今日日期文字（如 "2026-08-18"），第一、二段标题行显示
const todayText = ref('')

// ✅ 第一段"今日数据"5 个数字（初始全 0：接口没回来前页面也能正常渲染）
const businessData = ref({
  turnover: 0,              // 营业额（元）
  validOrderCount: 0,       // 有效订单数
  orderCompletionRate: 0,   // 订单完成率（0~1 小数，显示乘 100）
  unitPrice: 0,             // 平均客单价（元）
  newUsers: 0               // 新增用户数
})

// ✅ 第二段"订单管理"4 个数字（placedOrders 不用——后端恒返回 null）
const overviewOrders = ref({ completedOrders: 0, cancelledOrders: 0, allOrders: 0 })

// ✅ 第二段"已下单"数量：后端没给，用订单接口查 status=1（待付款）的总数补算（订单页小红球同款做法）
const placedOrdersCount = ref(0)

// ✅ 第三段菜品/套餐总览：{ sold: 已启售数, discontinued: 已停售数 }
const dishOverview = ref({ sold: 0, discontinued: 0 })
const setmealOverview = ref({ sold: 0, discontinued: 0 })

// ✅ 第四段两张订单表的数据和加载状态（loading=true 时表格显示转圈）
const placedOrderList = ref([])      // 已下单订单（status=1，最新 10 条）
const completedOrderList = ref([])   // 已完成订单（status=5，最新 10 条）
const placedLoading = ref(false)
const completedLoading = ref(false)

// ========== 二、工具函数 ==========

// ✅ 把日期转成 "yyyy-MM-dd" 文字（和统计页同一个函数，项目惯例各页自己复制一份）
// ⚠️ 两个新手易错点：1. getMonth() 从 0 开始数，必须 +1 才是真实月份
//                     2. padStart(2,'0') 给个位数补前导 0（8月3日 → "08-03" 而不是 "8-3"）
const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ========== 三、各段数据加载函数（模式统一：try/catch 静默 + code 判断 + null 兜底） ==========
// ⚠️ 为什么每个函数都套 try/catch？request.js 拦截器在请求失败时已经统一弹过"接口访问异常"，
//    这里静默处理即可；而且 7 个请求用 Promise.all 并发，一个失败抛错会连累全部，必须各自消化

// ✅ 第一段：今日运营数据
const loadBusinessData = async () => {
  try {
    const result = await businessDataApi()
    if (result.code === 1) {
      const d = result.data || {}
      // ⚠️ 后端 Double 字段（营业额/完成率/客单价）可能返回 null，必须 `|| 0` 兜底，
      //    否则模板里 null.toFixed(2) 会直接报错把整页打白
      businessData.value = {
        turnover: d.turnover || 0,
        validOrderCount: d.validOrderCount || 0,
        orderCompletionRate: d.orderCompletionRate || 0,
        unitPrice: d.unitPrice || 0,
        newUsers: d.newUsers || 0
      }
    } else {
      ElMessage.error(result.msg || '今日数据获取失败')
    }
  } catch (e) {
    // ✅ 静默处理（拦截器已弹过提示），数字保持默认 0
  }
}

// ✅ 第二段：订单概览（已完成/已取消/全部订单三个数）
const loadOverviewOrders = async () => {
  try {
    const result = await overviewOrdersApi()
    if (result.code === 1) {
      const d = result.data || {}
      overviewOrders.value = {
        completedOrders: d.completedOrders || 0,
        cancelledOrders: d.cancelledOrders || 0,
        allOrders: d.allOrders || 0
      }
    } else {
      ElMessage.error(result.msg || '订单概览获取失败')
    }
  } catch (e) {
    // ✅ 静默处理（拦截器已弹过提示）
  }
}

// ✅ 第二段："已下单"数量补算——查 status=1（待付款）的订单总数
// ⚠️ 技巧：只查"第 1 页、每页 1 条"，实际是为了拿返回里的 total 总数，不拉订单明细（省流量）
const loadPlacedCount = async () => {
  try {
    const result = await orderPageApi('', '', 1, '', '', 1, 1)
    if (result.code === 1) {
      placedOrdersCount.value = result.data.total || 0 // ✅ total 为空（接口异常）就显示 0
    }
  } catch (e) {
    // ✅ 静默处理，保持 0
  }
}

// ✅ 第三段：菜品总览（已启售/已停售数量）
const loadDishOverview = async () => {
  try {
    const result = await overviewDishesApi()
    if (result.code === 1) {
      const d = result.data || {}
      dishOverview.value = { sold: d.sold || 0, discontinued: d.discontinued || 0 }
    } else {
      ElMessage.error(result.msg || '菜品总览获取失败')
    }
  } catch (e) {
    // ✅ 静默处理（拦截器已弹过提示）
  }
}

// ✅ 第三段：套餐总览（已启售/已停售数量）
const loadSetmealOverview = async () => {
  try {
    const result = await overviewSetmealsApi()
    if (result.code === 1) {
      const d = result.data || {}
      setmealOverview.value = { sold: d.sold || 0, discontinued: d.discontinued || 0 }
    } else {
      ElMessage.error(result.msg || '套餐总览获取失败')
    }
  } catch (e) {
    // ✅ 静默处理（拦截器已弹过提示）
  }
}

// ✅ 第四段左表：已下单订单（status=1，最新 10 条——工作台只做预览，不分页，完整列表去订单页）
const loadPlacedOrders = async () => {
  placedLoading.value = true // ✅ 先开转圈，请求结束再关（finally 风格写在 try 外面更直观）
  try {
    const result = await orderPageApi('', '', 1, '', '', 1, 10)
    if (result.code === 1) {
      placedOrderList.value = result.data.records || [] // ✅ records 为空给空数组，表格自动显示"暂无数据"
    }
  } catch (e) {
    // ✅ 静默处理（拦截器已弹过提示）
  }
  placedLoading.value = false
}

// ✅ 第四段右表：已完成订单（status=5，最新 10 条）
const loadCompletedOrders = async () => {
  completedLoading.value = true
  try {
    const result = await orderPageApi('', '', 5, '', '', 1, 10)
    if (result.code === 1) {
      completedOrderList.value = result.data.records || []
    }
  } catch (e) {
    // ✅ 静默处理（拦截器已弹过提示）
  }
  completedLoading.value = false
}

// ✅ 一口气加载全页数据：7 个请求并发（互不依赖，最快的先回来先显示）
// ⚠️ 每个函数自己消化失败，Promise.all 不会被单个失败拖垮（统计页同款模式）
const loadAll = () => {
  Promise.all([
    loadBusinessData(),
    loadOverviewOrders(),
    loadPlacedCount(),
    loadDishOverview(),
    loadSetmealOverview(),
    loadPlacedOrders(),
    loadCompletedOrders()
  ])
}

// ========== 四、跳转函数（链接和新增方块共用） ==========

// ✅ 第一段"详细数据" → 数据统计页
const goReport = () => router.push('/report')
// ✅ 第二段"订单明细" → 订单管理页
const goOrder = () => router.push('/order')
// ✅ 第三段"菜品管理"链接 + "新增菜品"方块 → 菜品管理页
const goDish = () => router.push('/dish')
// ✅ 第三段"套餐管理"链接 + "新增套餐"方块 → 套餐管理页
const goSetmeal = () => router.push('/setmeal')

// ✅ 第四段"刷新"按钮：整页四段一起重拉（页面打开后数据不会自动变，给商家一个手动刷新入口）
const handleRefresh = () => loadAll()

// ✅ 页面挂载时：先记下今天的日期，再并发拉全页数据
onMounted(() => {
  todayText.value = formatDate(new Date())
  loadAll()
})
</script>

<template>
  <!-- ===== 第一段：今日数据 ===== -->
  <div class="section">
    <div class="section-head">
      <span class="section-title">今日数据</span>
      <span class="section-date">{{ todayText }}</span>
      <!-- ✅ 右上角超链接：蓝色文字按钮（色值表"文字按钮·修改"蓝），点击跳数据统计页 -->
      <span class="section-link" @click="goReport">详细数据</span>
    </div>
    <!-- ✅ 浅黄块通用结构：左小图标 + 右上大数字 + 右下小标签；flex 均分，窄屏自动换行 -->
    <div class="stat-row">
      <div class="stat-block">
        <el-icon class="stat-icon"><Money /></el-icon>
        <div class="stat-text">
          <div class="stat-num">￥{{ businessData.turnover.toFixed(2) }}</div>
          <div class="stat-label">营业额</div>
        </div>
      </div>
      <div class="stat-block">
        <el-icon class="stat-icon"><CircleCheck /></el-icon>
        <div class="stat-text">
          <div class="stat-num">{{ businessData.validOrderCount }}</div>
          <div class="stat-label">有效订单</div>
        </div>
      </div>
      <div class="stat-block">
        <el-icon class="stat-icon"><Odometer /></el-icon>
        <div class="stat-text">
          <!-- ⚠️ 完成率是 0.86 这种小数，乘 100 取整才是"86%"（loader 已把 null 归一成 0，不会 NaN） -->
          <div class="stat-num">{{ (businessData.orderCompletionRate * 100).toFixed(0) }}%</div>
          <div class="stat-label">订单完成率</div>
        </div>
      </div>
      <div class="stat-block">
        <el-icon class="stat-icon"><Coin /></el-icon>
        <div class="stat-text">
          <div class="stat-num">￥{{ businessData.unitPrice.toFixed(2) }}</div>
          <div class="stat-label">平均客单价</div>
        </div>
      </div>
      <div class="stat-block">
        <el-icon class="stat-icon"><User /></el-icon>
        <div class="stat-text">
          <div class="stat-num">{{ businessData.newUsers }}</div>
          <div class="stat-label">新增用户</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== 第二段：订单管理 ===== -->
  <div class="section">
    <div class="section-head">
      <span class="section-title">订单管理</span>
      <span class="section-date">{{ todayText }}</span>
      <!-- ✅ 右上角超链接 → 订单管理页 -->
      <span class="section-link" @click="goOrder">订单明细</span>
    </div>
    <div class="stat-row">
      <!-- ✅ "已下单"数字是前端补算的（后端 overviewOrders 接口的 placedOrders 字段恒为 null） -->
      <div class="stat-block">
        <el-icon class="stat-icon"><List /></el-icon>
        <div class="stat-text">
          <div class="stat-num">{{ placedOrdersCount }}</div>
          <div class="stat-label">已下单</div>
        </div>
      </div>
      <div class="stat-block">
        <el-icon class="stat-icon"><Finished /></el-icon>
        <div class="stat-text">
          <div class="stat-num">{{ overviewOrders.completedOrders }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
      <div class="stat-block">
        <el-icon class="stat-icon"><CircleClose /></el-icon>
        <div class="stat-text">
          <div class="stat-num">{{ overviewOrders.cancelledOrders }}</div>
          <div class="stat-label">已取消</div>
        </div>
      </div>
      <div class="stat-block">
        <el-icon class="stat-icon"><TakeawayBox /></el-icon>
        <div class="stat-text">
          <div class="stat-num">{{ overviewOrders.allOrders }}</div>
          <div class="stat-label">全部订单</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== 第三段：菜品总览 + 套餐总览（左右各半，窄屏自动上下堆叠） ===== -->
  <div class="section">
    <el-row :gutter="20">
      <!-- ✅ 左半：菜品总览 -->
      <el-col :xs="24" :md="12">
        <div class="section-head">
          <span class="section-title">菜品总览</span>
          <span class="section-link" @click="goDish">菜品管理</span>
        </div>
        <div class="stat-row">
          <div class="stat-block">
            <el-icon class="stat-icon"><Dish /></el-icon>
            <div class="stat-text">
              <div class="stat-num">{{ dishOverview.sold }}</div>
              <div class="stat-label">已启售</div>
            </div>
          </div>
          <div class="stat-block">
            <el-icon class="stat-icon"><SoldOut /></el-icon>
            <div class="stat-text">
              <div class="stat-num">{{ dishOverview.discontinued }}</div>
              <div class="stat-label">已停售</div>
            </div>
          </div>
          <!-- ✅ 新增菜品方块：虚线框 = "可以点去做事"（和旁边实线数据块区分），点击跳菜品管理页 -->
          <div class="add-box" @click="goDish">
            <el-icon class="add-box-icon"><Plus /></el-icon>
            <span class="add-box-text">新增菜品</span>
          </div>
        </div>
      </el-col>
      <!-- ✅ 右半：套餐总览（结构和左半完全同款，只是数据源和跳转目标不同） -->
      <el-col :xs="24" :md="12">
        <div class="section-head">
          <span class="section-title">套餐总览</span>
          <span class="section-link" @click="goSetmeal">套餐管理</span>
        </div>
        <div class="stat-row">
          <div class="stat-block">
            <el-icon class="stat-icon"><Box /></el-icon>
            <div class="stat-text">
              <div class="stat-num">{{ setmealOverview.sold }}</div>
              <div class="stat-label">已启售</div>
            </div>
          </div>
          <div class="stat-block">
            <el-icon class="stat-icon"><SoldOut /></el-icon>
            <div class="stat-text">
              <div class="stat-num">{{ setmealOverview.discontinued }}</div>
              <div class="stat-label">已停售</div>
            </div>
          </div>
          <!-- ✅ 新增套餐方块：点击跳套餐管理页 -->
          <div class="add-box" @click="goSetmeal">
            <el-icon class="add-box-icon"><Plus /></el-icon>
            <span class="add-box-text">新增套餐</span>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>

  <!-- ===== 第四段：订单信息（全页最大区域，灰底大面板衬托两张白表格） ===== -->
  <div class="order-panel">
    <div class="section-head">
      <span class="section-title">订单信息</span>
      <!-- ✅ 刷新按钮：黑底白字（按钮规范），点击整页四段数据一起重拉 -->
      <el-button class="btn-black" size="small" @click="handleRefresh">刷新</el-button>
    </div>
    <el-row :gutter="20">
      <!-- ✅ 左表：已下单（status=1，和订单管理页"已下单"选栏口径一致） -->
      <el-col :xs="24" :md="12">
        <div class="sub-title">已下单</div>
        <el-table :data="placedOrderList" stripe v-loading="placedLoading" :row-style="{ height: '50px' }">
          <el-table-column prop="number" label="订单号" min-width="130" align="center" />
          <el-table-column prop="userName" label="用户名" min-width="90" align="center" />
          <el-table-column prop="orderTime" label="下单时间" min-width="150" align="center" />
        </el-table>
      </el-col>
      <!-- ✅ 右表：已完成（status=5）；比左表多一列"实收金额"——已下单还没付款，没有实收金额 -->
      <el-col :xs="24" :md="12">
        <div class="sub-title">已完成</div>
        <el-table :data="completedOrderList" stripe v-loading="completedLoading" :row-style="{ height: '50px' }">
          <el-table-column prop="number" label="订单号" min-width="130" align="center" />
          <el-table-column prop="userName" label="用户名" min-width="90" align="center" />
          <el-table-column prop="orderTime" label="下单时间" min-width="150" align="center" />
          <el-table-column label="实收金额" min-width="90" align="center">
            <template #default="scope"><span>￥{{ scope.row.amount }}</span></template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
/* ===== 段落通用 ===== */
/* ✅ 每个段落之间的间距 */
.section {
  margin-bottom: 26px;
}

/* ✅ 标题行：左标题+日期，右链接（margin-left:auto 把链接顶到最右边） */
.section-head {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}

/* ✅ 段落标题：黑字加粗（色值表黑色） */
.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #000000;
  font-family: 微软雅黑;
}

/* ✅ 日期：灰色小字，低调陪衬（色值表"停用/禁用"灰） */
.section-date {
  font-size: 13px;
  color: #bebcbc;
  font-family: 微软雅黑;
  margin-left: 10px;
}

/* ✅ 右上角超链接：蓝色（色值表"文字按钮·修改"蓝），悬停加下划线提示可点 */
.section-link {
  margin-left: auto;
  font-size: 14px;
  color: #409eff;
  font-family: 微软雅黑;
  cursor: pointer;
}
.section-link:hover {
  text-decoration: underline;
}

/* ===== 浅黄块（全站统一块样式） ===== */
/* ✅ flex 布局：块自动均分一行；flex-wrap 让窄屏时块自动换行不挤爆 */
.stat-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

/* ✅ 浅黄块：底色 #fffbf0（用户指定浅黄）+ 辅助黄极细描边（勾出与白底的边界） */
/*    ⚠️ #fffbf0 是用户 2026-08-18 指定的新颜色，已登记进 CLAUDE.md 7.1 色值表 */
.stat-block {
  flex: 1;
  min-width: 150px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  background-color: #fffbf0;
  border: 1px solid #ffe185;
  border-radius: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease; /* ✅ 悬停渐变动画 */
}

/* ✅ 悬停：描边变金黄 + 轻微浮起阴影，告诉用户"这块有内容"（不改变布局） */
.stat-block:hover {
  border-color: #ffc100;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

/* ✅ 块内小图标：金黄 22px——"不扎眼"靠小尺寸实现，颜色和顶栏品牌色呼应 */
.stat-icon {
  font-size: 22px;
  color: #ffc100;
  flex-shrink: 0; /* ✅ 图标固定大小，不被数字挤扁 */
}

/* ✅ 图标右侧：上大数字、下小标签 */
.stat-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ✅ 大数字：黑粗，块里最醒目的信息 */
.stat-num {
  font-size: 22px;
  font-weight: bold;
  color: #000000;
  font-family: 微软雅黑;
}

/* ✅ 小标签：深灰小字，说明数字是什么 */
.stat-label {
  font-size: 13px;
  color: #333333;
  font-family: 微软雅黑;
}

/* ===== 新增菜品/套餐方块 ===== */
/* ✅ 和浅黄块等宽等高，但内容竖排居中；虚线框 = "可以点去做事"（和实线数据块视觉区分） */
.add-box {
  flex: 1;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px 20px;
  background-color: #fffbf0;
  border: 1px dashed #bebcbc; /* 灰色虚线（色值表"停用/禁用"灰，dish 页上传框同款先例） */
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}
.add-box:hover {
  border-color: #ffc100; /* ✅ 悬停虚线变金黄，提示可以点 */
}

/* ✅ 方块里的加号图标（深灰，低调但清晰） */
.add-box-icon {
  font-size: 20px;
  color: #333333;
}

/* ✅ 方块文字 */
.add-box-text {
  font-size: 14px;
  color: #333333;
  font-family: 微软雅黑;
}

/* ===== 第四段：订单信息大面板 ===== */
/* ✅ 灰底大面板（色值表"页面底色"灰）：整页最大的一段，用底色块突出视觉重量，白表格放里面自动显眼 */
.order-panel {
  background-color: #f3f4f7;
  border-radius: 8px;
  padding: 20px;
  margin-top: 4px;
}

/* ✅ 面板里每张表上方的小标题（已下单 / 已完成） */
.sub-title {
  font-size: 14px;
  font-weight: bold;
  color: #000000;
  font-family: 微软雅黑;
  margin-bottom: 10px;
}

/* ✅ 黑底白字按钮（按钮规范，各页 scoped 内复制一份的项目惯例）：刷新按钮用 */
.btn-black {
  background-color: #000000 !important;
  color: #ffffff !important;
  border: none !important;
  padding: 8px 20px;
  border-radius: 6px;
}
.btn-black:hover {
  background-color: #333333 !important;
  color: #ffffff !important;
}
</style>
