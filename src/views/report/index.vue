<script setup>
// ===== 数据统计页面：顶部 5 个日期范围按钮 + 2×2 四张统计图表卡片 =====
// 图表用 ECharts 画（用户拍板引入的图表库）；数据来自后端 4 个报表接口（见 src/api/report.js）
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'   // ✅ 全量引入 ECharts：一次引入所有图表类型，简单省事（体积大一点，教学项目无所谓）
import { turnoverStatisticsApi, userStatisticsApi, ordersStatisticsApi, top10Api } from '@/api/report.js'

// ---------- 日期范围预设（顶部的 5 个按钮） ----------
// ✅ 每个按钮 = 一种"从哪天到哪天"的算法（type 是算法编号，getRangeByType 里按它算日期）
// ⚠️ 下标 1 = 近7日 是默认选中（activeTab 初始值是 1）：
//    页面打开就有 7 个数据点画图最好看；若默认"昨日"，历史数据少时图是空的，容易误以为页面坏了
const RANGE_TABS = [
  { label: '昨日', type: 'yesterday' },
  { label: '近7日', type: 'week7' },
  { label: '近30日', type: 'month30' },
  { label: '本周', type: 'thisWeek' },
  { label: '本月', type: 'thisMonth' }
]
const activeTab = ref(1)             // 当前选中第几个按钮（默认第 2 个 = 近7日）
const dateRangeText = ref('')        // 右侧显示的日期范围文字（如 "2026-08-12 至 2026-08-18"）

// ---------- 订单统计卡片里的三个总数（订单接口额外返回的单值，不是图表数据） ----------
const orderStats = ref({
  totalOrderCount: 0,        // 订单总数
  validOrderCount: 0,        // 有效订单数
  orderCompletionRate: 0     // 订单完成率（后端返回 0.98 这种小数，显示时要乘 100）
})

// ---------- 4 个图表容器（模板里 div 的 ref） ----------
// ✅ 命名 xxxChartRef 结尾（项目规范：ref 以 Ref 结尾）
const turnoverChartRef = ref(null)   // 营业额统计的图表容器
const userChartRef = ref(null)       // 用户统计的图表容器
const ordersChartRef = ref(null)     // 订单统计的图表容器
const top10ChartRef = ref(null)      // 销量 TOP10 的图表容器

// ✅ 4 个 ECharts 实例统一存这个普通对象里（key = 图表名字）
// ⚠️ 用普通对象 {} 而不是 ref({})：实例只是"干活的对象"，模板里不显示它，
//    放进 ref 会让 Vue 白费力气去监听它的变化（响应式），反而浪费性能
const charts = {}

// ---------- 日期工具函数 ----------
// ✅ 把 Date 对象格式化成后端要的 "yyyy-MM-dd" 字符串
// ⚠️ 坑 1：getMonth() 从 0 开始数（0=一月 11=十二月），所以必须 +1
// ⚠️ 坑 2：月/日只有 1 位时要补前导 0（8月 → "08"），用 String(x).padStart(2, '0') 补
const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ✅ 按按钮类型算出 { begin, end }（都是 "yyyy-MM-dd" 字符串，直接发给后端）
// ⚠️ 关键技巧：setDate(d.getDate() - n) 会自动处理跨月/跨年（8月1日减1天=7月31日），不用自己算
const getRangeByType = (type) => {
  const today = new Date()

  if (type === 'yesterday') {
    // ✅ 昨日：begin = end = 昨天（只统计一天，所以两个日期相同）
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return { begin: formatDate(d), end: formatDate(d) }
  }

  if (type === 'week7') {
    // ✅ 近7日 = 今天往前推 6 天（今天也算 1 天，加起来共 7 天）
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return { begin: formatDate(d), end: formatDate(today) }
  }

  if (type === 'month30') {
    // ✅ 近30日 = 今天往前推 29 天，加起来共 30 天
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return { begin: formatDate(d), end: formatDate(today) }
  }

  if (type === 'thisWeek') {
    // ✅ 本周 = 本周一 到 今天
    // ⚠️ 坑：getDay() 里 周日返回 0、周一返回 1、周六返回 6
    //   所以"离本周一有几天"要特殊处理：周日时周一是 6 天前；其余是 day-1 天前
    //   （如果直接 day-1，周日会算出 -1，日期就错了）
    const d = new Date()
    const dayOfWeek = d.getDay()
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    d.setDate(d.getDate() - diff)
    return { begin: formatDate(d), end: formatDate(today) }
  }

  // ✅ 本月 = 本月 1 号 到 今天
  // ⚠️ 坑：new Date(年, 月, 日) 的月份从 0 开始，所以传 getMonth() 原值（不加不减）+ 日传 1，
  //   造出来的就是"本月 1 号"（例如 new Date(2026, 7, 1) = 2026年8月1日）
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  return { begin: formatDate(firstDay), end: formatDate(today) }
}

// ✅ 刷新右侧的日期范围文字（如 "2026-08-12 至 2026-08-18"）
// 打开页面和切换按钮时都要调一次
const updateDateRangeText = () => {
  const { begin, end } = getRangeByType(RANGE_TABS[activeTab.value].type)
  dateRangeText.value = `${begin} 至 ${end}`
}

// ✅ 通用转换函数：后端列表字段都是"逗号分隔的一串文字"（如 "200,210,220"），
//   必须拆成数组才能喂给 ECharts（这是后端数据契约，四个接口都遵守）
// ⚠️ 坑：空字符串直接 .split(',') 会得到 ['']（一个假元素），所以要先判断不为空
const splitToArray = (str) => (str ? str.split(',') : [])

// ---------- ECharts 实例管理（4 张图共用的通用函数，避免重复代码） ----------
// ✅ 通用初始化：拿容器 ref 创建 ECharts 实例，按名字存进 charts 对象
// ⚠️ 坑：echarts.init 的参数必须是真实的 DOM 元素（标签），
//   模板 ref 是个"盒子"，要 .value 才能取出里面的 DOM 元素
const initChart = (key, chartRef) => {
  charts[key] = echarts.init(chartRef.value)
}

// ✅ 通用刷新：把新 option 塞给旧实例（setOption = 给实例换数据重画）
// ⚠️ 切换日期时只 setOption 不销毁重建：
//   1. setOption 是 ECharts 官方推荐的更新方式，自带平滑的切换动画
//   2. 销毁重建每次要 dispose 4 个实例再 init 4 个，代码多、速度慢，
//      而且一旦忘记 dispose 就会造成内存泄漏（实例越堆越多）
//   3. 本页 4 张图的类型固定（折线/柱状），不存在要换图表类型的场景，没有重建的必要
const renderChart = (key, option) => {
  charts[key].setOption(option)
}

// ---------- 4 张图的 option 构造函数 ----------
// ✅ 四张图共用的"骨架"配置（每张图都写上，注释说明用途）：
//   tooltip：鼠标悬停提示框；trigger:'axis' = 自动吸附到最近的数据点，一次显示该点的所有系列数值
//   grid：图表绘图区的留白；containLabel: true = 坐标轴上的文字也计入留白，
//         这样长文字（日期、菜名）不会被裁掉半个字（⚠️ 不加的话 TOP10 的长菜名会被切掉）
//   axisLabel：坐标轴文字用黑色（7.1 表"文字黑 #000000"）
//   splitLine：背景横向网格线用页面底色当浅灰（7.1 表"页面底色 #f3f4f7"）
//   axisLine：坐标轴线用停用灰（7.1 表"停用/禁用 #bebcbc"），比纯黑柔和
const COMMON_AXIS = {
  axisLabel: { color: '#000000', fontSize: 12 },
  splitLine: { lineStyle: { color: '#f3f4f7' } },
  axisLine: { lineStyle: { color: '#bebcbc' } }
}

// ✅ 营业额统计：单折线（无图例——单条线不用图例，卡片标题已经说明画的是什么）
// color 数组放第 1 个系列的颜色：金黄（7.1 表"品牌主色 #ffc100"）
// boundaryGap: false = 折线从图表最左边贴边开始，不空半格
// smooth: true = 平滑曲线（比生硬的折角更好看）；symbolSize = 数据点圆点大小
const buildTurnoverOption = (dateList, turnoverList) => ({
  color: ['#ffc100'],
  tooltip: { trigger: 'axis' },
  grid: { left: '3%', right: '4%', bottom: '3%', top: 30, containLabel: true },
  xAxis: { type: 'category', data: dateList, boundaryGap: false, ...COMMON_AXIS },
  yAxis: { type: 'value', ...COMMON_AXIS },
  series: [{
    name: '营业额',
    type: 'line',
    data: turnoverList,
    smooth: true,
    lineStyle: { width: 2 },
    symbolSize: 8
  }]
})

// ✅ 用户统计：双折线 + 图例（两条线必须带图例，否则分不清哪条是哪条）
// color 数组顺序对应 series 顺序：第 1 条线（新增用户）= 金黄 #ffc100，第 2 条线（用户总量）= 蓝 #409eff
// ⚠️ 两条线共用一个 y 轴：单位都是"人"、数值量级一致，不必做双 y 轴
//   （双 y 轴是图表大忌，会把两条线的走势人为地拉到一起，制造虚假的相似）
const buildUserOption = (dateList, totalUserList, newUserList) => ({
  color: ['#ffc100', '#409eff'],
  tooltip: { trigger: 'axis' },
  legend: { data: ['新增用户', '用户总量'], top: 0 },
  grid: { left: '3%', right: '4%', bottom: '3%', top: 30, containLabel: true },
  xAxis: { type: 'category', data: dateList, boundaryGap: false, ...COMMON_AXIS },
  yAxis: { type: 'value', ...COMMON_AXIS },
  series: [
    {
      name: '新增用户',
      type: 'line',
      data: newUserList,
      smooth: true,
      lineStyle: { width: 2 },
      symbolSize: 8
    },
    {
      name: '用户总量',
      type: 'line',
      data: totalUserList,
      smooth: true,
      lineStyle: { width: 2 },
      symbolSize: 8
    }
  ]
})

// ✅ 订单统计：双折线 + 图例（用户 2026-08-18 拍板：从柱状图改成折线图，和另外两张折线图风格统一）
// 订单总数=金黄 #ffc100、有效订单数=绿 #67c23a，都是 7.1 表色值
// boundaryGap: false = 折线从图表最左边贴边开始（折线图惯例，和营业额/用户图一致）
const buildOrderOption = (dateList, orderCountList, validOrderCountList) => ({
  color: ['#ffc100', '#67c23a'],
  tooltip: { trigger: 'axis' },
  legend: { data: ['订单总数', '有效订单数'], top: 0 },
  grid: { left: '3%', right: '4%', bottom: '3%', top: 30, containLabel: true },
  xAxis: { type: 'category', data: dateList, boundaryGap: false, ...COMMON_AXIS },
  yAxis: { type: 'value', ...COMMON_AXIS },
  series: [
    { name: '订单总数', type: 'line', data: orderCountList, smooth: true, lineStyle: { width: 2 }, symbolSize: 8 },
    { name: '有效订单数', type: 'line', data: validOrderCountList, smooth: true, lineStyle: { width: 2 }, symbolSize: 8 }
  ]
})

// ✅ 销量排名 TOP10：横向柱状（无图例——单系列，卡片标题已说明）
// 横向柱状的要点 = x/y 轴类型对调：数值轴放 x（下方），菜名放 y（左侧）
// inverse: true = y 轴倒序，让销量第 1 名排在最上面（排名图必须第 1 名在最上，符合阅读习惯）
// label: 柱尾直接标数值——排名图"名次+销量"就是故事本身，直标比悬停提示更直观
//   （别的图不直标，避免满屏数字；这里选择性直标）
// borderRadius: [0,4,4,0] = 横向柱的右端（数值端）圆角
const buildTop10Option = (nameList, numberList) => ({
  color: ['#ffc100'],
  tooltip: { trigger: 'axis' },
  grid: { left: '3%', right: '10%', bottom: '3%', top: 30, containLabel: true },
  xAxis: { type: 'value', ...COMMON_AXIS },
  yAxis: { type: 'category', data: nameList, inverse: true, ...COMMON_AXIS },
  series: [{
    name: '销量',
    type: 'bar',
    data: numberList,
    barMaxWidth: 20,
    itemStyle: { borderRadius: [0, 4, 4, 0] },
    label: { show: true, position: 'right', color: '#000000' }
  }]
})

// ---------- 拉数据（4 个接口各一个加载函数，共用 loadAll 调度） ----------
// ✅ 营业额：字符串数组转数字数组（.map(Number)，y 轴必须是数字，字符串会被当成文字分类）
// ⚠️ try/catch 兜底：接口请求失败（网络错误、后端 500）时把异常接住，
//   否则异常会一路抛到浏览器控制台变"未捕获异常"红字，还会连累 Promise.all 里的另外三张图
const loadTurnover = async (begin, end) => {
  try {
    const result = await turnoverStatisticsApi(begin, end)
    if (result.code === 1) {
      const dateList = splitToArray(result.data.dateList)
      const turnoverList = splitToArray(result.data.turnoverList).map(Number)
      renderChart('turnover', buildTurnoverOption(dateList, turnoverList))
    } else {
      ElMessage.error(result.msg || '营业额统计获取失败')
    }
  } catch (error) {
    // ✅ 失败时静默处理：错误提示已由 request.js 拦截器统一弹过（"接口访问异常"），
    //   这里不重复弹；图表保持空白，另外三张图照常画
  }
}

// ✅ 用户统计：用户总量和新增用户两条线，同样要拆数组 + 转数字
// ⚠️ 和 loadTurnover 一样的 try/catch 兜底，防止异常污染控制台、连累其他图表
const loadUser = async (begin, end) => {
  try {
    const result = await userStatisticsApi(begin, end)
    if (result.code === 1) {
      const dateList = splitToArray(result.data.dateList)
      const totalUserList = splitToArray(result.data.totalUserList).map(Number)
      const newUserList = splitToArray(result.data.newUserList).map(Number)
      renderChart('user', buildUserOption(dateList, totalUserList, newUserList))
    } else {
      ElMessage.error(result.msg || '用户统计获取失败')
    }
  } catch (error) {
    // ✅ 静默处理（理由同 loadTurnover 的注释）
  }
}

// ✅ 订单统计：除了画柱状图，还把接口返回的三个总数存进 orderStats（卡片里显示文字用）
// ⚠️ 和 loadTurnover 一样的 try/catch 兜底，防止异常污染控制台、连累其他图表
const loadOrders = async (begin, end) => {
  try {
    const result = await ordersStatisticsApi(begin, end)
    if (result.code === 1) {
      const dateList = splitToArray(result.data.dateList)
      const orderCountList = splitToArray(result.data.orderCountList).map(Number)
      const validOrderCountList = splitToArray(result.data.validOrderCountList).map(Number)
      renderChart('orders', buildOrderOption(dateList, orderCountList, validOrderCountList))
      orderStats.value = {
        totalOrderCount: result.data.totalOrderCount,
        validOrderCount: result.data.validOrderCount,
        orderCompletionRate: result.data.orderCompletionRate
      }
    } else {
      ElMessage.error(result.msg || '订单统计获取失败')
    }
  } catch (error) {
    // ✅ 静默处理（理由同 loadTurnover 的注释）
  }
}

// ✅ 销量 TOP10：菜名直接当分类用（文字），销量转数字
// ⚠️ 和 loadTurnover 一样的 try/catch 兜底，防止异常污染控制台、连累其他图表
const loadTop10 = async (begin, end) => {
  try {
    const result = await top10Api(begin, end)
    if (result.code === 1) {
      const nameList = splitToArray(result.data.nameList)
      const numberList = splitToArray(result.data.numberList).map(Number)
      renderChart('top10', buildTop10Option(nameList, numberList))
    } else {
      ElMessage.error(result.msg || '销量TOP10获取失败')
    }
  } catch (error) {
    // ✅ 静默处理（理由同 loadTurnover 的注释）
  }
}

// ✅ 一次拉 4 个接口（Promise.all 并发请求，互不等待；每个函数内部自己处理成败，
//   一个接口失败不影响另外三张图）
const loadAll = () => {
  const { begin, end } = getRangeByType(RANGE_TABS[activeTab.value].type)
  Promise.all([
    loadTurnover(begin, end),
    loadUser(begin, end),
    loadOrders(begin, end),
    loadTop10(begin, end)
  ])
}

// ✅ 切换日期范围按钮：改选中态 → 更新右侧日期文字 → 重新拉数据刷新 4 张图
const switchTab = (index) => {
  activeTab.value = index
  updateDateRangeText()
  loadAll()
}

// ✅ 窗口大小变化时，图表不会自己跟着变，必须手动通知每个实例重算尺寸
const handleResize = () => {
  Object.values(charts).forEach((chart) => chart && chart.resize())
}

// ✅ 页面加载完成后：初始化 4 个实例 → 算好默认日期范围文字 → 拉数据画图 → 挂 resize 监听
onMounted(() => {
  initChart('turnover', turnoverChartRef)
  initChart('user', userChartRef)
  initChart('orders', ordersChartRef)
  initChart('top10', top10ChartRef)
  updateDateRangeText()
  loadAll()
  window.addEventListener('resize', handleResize)
})

// ✅ 页面销毁前（切走路由时）：清理干净，不留后患
// ⚠️ 1. 移除 resize 监听：不移除的话，页面没了监听还在，窗口一变它就去操作已销毁的实例 → 报错
// ⚠️ 2. 逐个销毁 ECharts 实例：dispose = 释放图表占用的内存（像用完电器要拔插头），
//      忘 dispose 会造成内存泄漏（每进出一次页面多占一块内存）
// ✅ 本项目路由切换会卸载组件，切走再切回来会重新走 onMounted，所以每次进来都是全新状态
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  Object.values(charts).forEach((chart) => chart && chart.dispose())
})
</script>

<template>
  <!-- ===== 顶部一行：左边 5 个日期范围按钮，右边显示已选日期范围 ===== -->
  <div class="top-bar">
    <!-- ✅ 5 个按钮用 div 写（和订单页的选栏一个思路）：按钮本来就是"点一下切状态"的 tab 性质，
         比 el-button 少一层默认样式覆盖 -->
    <div class="range-btns">
      <div
        v-for="(tab, index) in RANGE_TABS"
        :key="tab.label"
        class="range-btn"
        :class="{ 'range-btn-active': activeTab === index }"
        @click="switchTab(index)"
      >
        {{ tab.label }}
      </div>
    </div>

    <!-- ✅ 右侧日期范围文字：由当前选中按钮算出来的 begin/end 拼成 -->
    <span class="range-text">已选日期范围：{{ dateRangeText }}</span>
  </div>

  <!-- ===== 图表区：两行两列四张白卡片 ===== -->
  <!-- ✅ el-row/el-col 布局（项目 CRUD 页一直在用这套）：span=12 = 一行对半分成两列；
       gutter=20 = 两张卡片之间的间距 20px -->
  <el-row :gutter="20">
    <el-col :span="12">
      <!-- ===== 卡片 1：营业额统计 ===== -->
      <div class="chart-card">
        <div class="card-title">营业额统计</div>
        <!-- ⚠️ 图表容器必须有明确高度（在样式里设 320px），ECharts 才能算出画布大小 -->
        <div ref="turnoverChartRef" class="chart-box"></div>
      </div>
    </el-col>

    <el-col :span="12">
      <!-- ===== 卡片 2：用户统计 ===== -->
      <div class="chart-card">
        <div class="card-title">用户统计</div>
        <div ref="userChartRef" class="chart-box"></div>
      </div>
    </el-col>
  </el-row>

  <el-row :gutter="20" style="margin-top: 20px">
    <el-col :span="12">
      <!-- ===== 卡片 3：订单统计（比别的卡片多一行"三个总数"文字） ===== -->
      <div class="chart-card">
        <div class="card-title">订单统计</div>
        <!-- ✅ 订单接口额外返回的三个总数，直接当文字显示在标题下方（不是图表数据） -->
        <div class="order-stats">
          订单总数：{{ orderStats.totalOrderCount }}　有效订单数：{{ orderStats.validOrderCount }}　订单完成率：{{ (orderStats.orderCompletionRate * 100).toFixed(0) }}%
        </div>
        <!-- ⚠️ 完成率是后端返回的 0.98 这种小数，乘 100 再取整才是 98%（注释记在 script 里） -->
        <div ref="ordersChartRef" class="chart-box"></div>
      </div>
    </el-col>

    <el-col :span="12">
      <!-- ===== 卡片 4：销量排名 TOP10 ===== -->
      <div class="chart-card">
        <div class="card-title">销量排名TOP10</div>
        <div ref="top10ChartRef" class="chart-box"></div>
      </div>
    </el-col>
  </el-row>
</template>

<style scoped>
/* ===== 顶部：按钮组在左、日期范围文字在右（两端对齐） ===== */
.top-bar {
  display: flex;
  justify-content: space-between;   /* ✅ 左右两端顶开 */
  align-items: center;
  margin-bottom: 20px;
}

.range-btns {
  display: flex;
  gap: 15px;                        /* ✅ 按钮之间的间距 */
}

/* ===== 日期范围按钮：选中=黑底白字，未选中=白底黑字描边（符合项目按钮规范） ===== */
.range-btn {
  padding: 8px 22px;
  background-color: #ffffff;        /* 未选中：白底（7.1 表"内容卡片 #ffffff"） */
  color: #000000;                   /* 未选中：黑字（7.1 表"文字黑"） */
  border: 1px solid #000000;        /* 未选中：黑色描边 */
  border-radius: 6px;               /* 圆角 6px（7.1 表"圆角统一 6–10px"） */
  font-size: 14px;
  font-family: "微软雅黑";
  cursor: pointer;                  /* 鼠标移上去变成小手，提示可点击 */
  transition: background-color 0.2s ease;   /* ✅ 选中/取消时背景色平滑过渡 */
}

/* 未选中时鼠标悬停：辅助黄提示（7.1 表"辅助黄 #ffe185"） */
.range-btn:hover {
  background-color: #ffe185;
}

/* ✅ 选中的按钮：黑底白字（7.1 表"黑底白字按钮"；用户拍板的按钮规范） */
.range-btn-active {
  background-color: #000000;
  color: #ffffff;
}

/* ✅ 选中的按钮悬停：深灰底（7.1 表"黑底白字按钮悬停 #333333"） */
.range-btn-active:hover {
  background-color: #333333;
}

/* ===== 右侧日期范围文字 ===== */
.range-text {
  font-size: 14px;
  font-family: "微软雅黑";
  color: #000000;
}

/* ===== 图表卡片：白底圆角（7.1 表"内容卡片 #ffffff + 圆角"） ===== */
/* 不用 el-card：它自带边框和内边距需要一堆覆盖，项目也没有使用先例，普通 div 自写更直白 */
.chart-card {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 20px;
}

.card-title {
  font-size: 16px;
  font-weight: bold;
  font-family: "微软雅黑";
  color: #000000;
  margin-bottom: 10px;
}

/* ⚠️ 图表容器必须有明确高度：ECharts 要按容器大小算画布，没有高度会报
   "Can't get DOM width or height" 并且画不出来 */
.chart-box {
  width: 100%;
  height: 320px;
}

/* ===== 订单统计卡片里的三个总数文字（标题下方一行） ===== */
.order-stats {
  font-size: 14px;
  font-family: "微软雅黑";
  color: #000000;
  margin-bottom: 10px;
}
</style>
