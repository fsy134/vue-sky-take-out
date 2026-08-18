<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Expand, Fold,User, Lock, SwitchButton } from '@element-plus/icons-vue'
import { getShopStatusApi, setShopStatusApi } from '@/api/shop.js'
// ✅ 导入"叮咚"提示音（vite 会把 wav 文件当成静态资源，返回它的网址供 Audio 播放）
import dingdongSound from '@/assets/audio/dingdong.wav'

const router = useRouter()
const isCollapse = ref(false);

// ========== 顶栏"管理员"下拉菜单：修改密码 / 退出登录 ==========
// ✅ el-dropdown 的 @command 事件会把 el-dropdown-item 上的 command 值传进来（a=修改密码，b=退出登录）
const handleCommand = (command) => {
  if (command === 'a') {
    // ✅ 修改密码：弹窗功能后续再做，先弹个提示
    ElMessage.info('修改密码功能开发中')
  } else if (command === 'b') {
    // ✅ 退出登录两步走：1. 删掉浏览器里存的用户信息（含 token） 2. 跳回登录页
    localStorage.removeItem('userInfo')
    router.push('/login')
  }
}

// ========== 营业状态：开店 / 打烊 ==========

// ✅ shopStatus 存店铺状态数字：1 = 营业中，0 = 打烊中
//    初始给 1（营业中）：和后端约定一致，且后端 Redis 里还没存过状态时页面也能正常显示
//    顶栏那个红色"营业中"标签就是根据它来显示文字和颜色的
const shopStatus = ref(1)

// ✅ statusDialogVisible 控制"营业状态设置"弹窗的显示/隐藏（true 显示、false 隐藏）
const statusDialogVisible = ref(false)

// ✅ 顶栏"营业状态设置"按钮的点击事件：把弹窗打开，让用户选开店还是打烊
const handleStatusClick = () => {
  statusDialogVisible.value = true
}

// ✅ 页面加载时向后端查询一次真实营业状态（后端存在 Redis 里，刷新页面也不会丢）
const loadShopStatus = async () => {
  try {
    const result = await getShopStatusApi()
    if (result.code === 1) {
      // ✅ 查询成功：把后端返回的数字存起来，标签自动变成对应文字和颜色
      shopStatus.value = result.data
    } else {
      // ⚠️ 后端 Redis 还没存过状态时会走到这里（如"店铺状态获取失败"）：
      //    弹后端返回的提示，标签保持默认"营业中"，用户可以点按钮主动设置一次
      ElMessage.error(result.msg)
    }
  } catch (e) {
    // ✅ 请求本身失败（断网/500）时静默处理：request.js 拦截器已经统一弹过"接口访问异常"提示，这里不重复弹
  }
}

// ✅ 用户点了弹窗里的"开店"或"打烊"：把状态数字发给后端，成功后更新标签并关弹窗
// status 参数：1 = 开店，0 = 打烊（由弹窗里两个按钮各自的 @click 传进来）
const handleSetStatus = async (status) => {
  try {
    const result = await setShopStatusApi(status)
    if (result.code === 1) {
      // ✅ 三步走：1. 更新本地状态（标签变色） 2. 关弹窗 3. 弹成功提示
      shopStatus.value = status
      statusDialogVisible.value = false
      ElMessage.success(status === 1 ? '店铺已开店营业' : '店铺已打烊')
    } else {
      ElMessage.error(result.msg)
    }
  } catch (e) {
    // ✅ 请求失败静默处理（原因同上）：弹窗保持打开，用户可以直接再点一次
  }
}

// ========== 来单/催单提醒：WebSocket 长连接 + 右上角弹窗 + 提示音 ==========
// WebSocket 可以理解成"前台和后厨之间的一条对讲机专线"：
// 普通接口是"你问一句、后端答一句"（一问一答），WebSocket 是"后端有事主动喊你"（后端主动推消息），
// 所以客人下单/催单时，商家页面不需要刷新就能立刻收到提醒

// ✅ orderTip 存当前这条提醒的内容（type：1=新订单 2=催单；orderId：订单 id；content：后端写的提醒文字）
const orderTip = ref(null)

// ✅ tipVisible 控制右上角提醒卡片的显示/隐藏（true 显示，false 隐藏）
const tipVisible = ref(false)

// ✅ 下面三个不是"页面变量"，是后台工作人员，用普通 let 即可（不需要 ref 响应式）：
let ws = null              // WebSocket 连接对象
let reconnectTimer = null  // 断线重连的定时器
let tipTimer = null        // 弹窗 15 秒自动关闭的定时器

// ✅ 建立 WebSocket 连接
const connectWebSocket = () => {
  // sid：后端用它当"钥匙"登记连接（不校验身份），这里取登录员工的 id，没取到就用 'admin'
  let sid = 'admin'
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
  if (userInfo.id) sid = String(userInfo.id)

  // ✅ 地址走 location.host（当前页面自己的地址）：
  //    开发时页面在 localhost:5200，vite 代理会把 /ws 开头转发到后端 8080（vite.config.js 里已配好）
  const url = `ws://${location.host}/ws/${sid}`
  ws = new WebSocket(url)

  // ✅ 收到后端消息时触发（注意：后端每 5 秒还会发一条心跳测试消息，必须过滤掉）
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      // ✅ 只对来单（type=1）和催单（type=2）弹窗响铃，其他消息一律忽略
      if (data.type === 1 || data.type === 2) {
        showOrderTip(data)
      }
    } catch (e) {
      // ✅ 走到这里说明消息不是 JSON（就是那条"这是来自服务端的消息：…"测试消息），静默忽略
    }
  }

  // ✅ 连接断开时触发（后端重启、网络断了等）：5 秒后自动重连，商家不用手动刷新页面
  ws.onclose = () => {
    if (reconnectTimer) return // 防止重复排队重连
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connectWebSocket()
    }, 5000)
  }
}

// ✅ 收到来单/催单消息后：弹卡片 + 响铃 + 15 秒自动消失
const showOrderTip = (data) => {
  orderTip.value = data
  tipVisible.value = true
  playSound()
  // ✅ 15 秒后自动关闭；如果期间又来新提醒，先清掉旧计时重新算，让商家有足够时间看到最新一条
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => {
    tipVisible.value = false
  }, 15000)
}

// ✅ 播放"叮咚"提示音
const playSound = () => {
  // ✅ 每次 new 一个 Audio 播放（浏览器规定：页面必须先被用户点过才能出声——商家已登录点过，没问题）
  const audio = new Audio(dingdongSound)
  // ✅ play() 返回 Promise：万一浏览器拦截了播放，用 catch 兜住，避免控制台报"未捕获异常"
  audio.play().catch(() => {})
}

// ✅ 点卡片右上角 X：关掉弹窗并清掉自动关闭计时
const closeTip = () => {
  tipVisible.value = false
  if (tipTimer) {
    clearTimeout(tipTimer)
    tipTimer = null
  }
}

// ✅ 点整张卡片（或"去处理"按钮）：关弹窗 + 跳转到订单管理页处理订单
const goToOrder = () => {
  closeTip()
  router.push('/order')
}

// ✅ 组件挂载后：查营业状态 + 建立 WebSocket 连接（提醒功能全站生效，因为 layout 包着所有页面）
onMounted(() => {
  loadShopStatus()
  connectWebSocket()
})

// ✅ 组件卸载（退出登录）时：断开连接、清理两个定时器，避免"僵尸连接"和内存泄漏
onBeforeUnmount(() => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (tipTimer) {
    clearTimeout(tipTimer)
    tipTimer = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
})

</script>

<template>
<div class="common-layout">
    <el-container>
<!-- header区域 -->
      <el-header class="header">
        <div class="header-left">
        <el-button 
            :icon="isCollapse ? Expand : Fold" 
            @click="isCollapse = !isCollapse"
            text
            style="color: black; font-size: 20px; padding: 0; margin-right: 18px;"
          />
          <img src="/src/assets/logo.png" alt="logo" class="logo" />
          <div class="title-wrapper">
        <span class="Title">烧烧餐厅</span>
        <span class="sub-title">shao shao restaurant</span>

          </div>

          <!-- ✅ 营业状态标签：文字和颜色都由 shopStatus 决定（1=营业中红，0=打烊中灰），不再是写死的 -->
          <el-tag type="danger" class="status-tag" :class="shopStatus === 0 ? 'closed-tag' : 'deep-red-tag'">
            {{ shopStatus === 0 ? '打烊中' : '营业中' }}
          </el-tag>
        </div>

      <div class="header-right">
          <el-button type="text" style="color: black;" class="statusSetting" @click="handleStatusClick"><el-icon><Shop /></el-icon><span>营业状态设置</span></el-button>
          <el-dropdown @command="handleCommand" >
            <span class="el-dropdown-link">
              管理员    <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown >
              <el-dropdown-menu >
                <el-dropdown-item command="a">修改密码</el-dropdown-item>
                <el-dropdown-item command="b">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-container>

<!-- 侧边区域 -->
        <el-aside  :width="isCollapse ? '64px' : '220px'"  class="aside">

          
      <el-menu
        active-text-color="#ffd04b"
        background-color="#343744"
        class="侧边菜单"
        default-active="2"
        text-color="#fff"
        :router="true"
        :collapse="isCollapse"
        :collapse-transition="true"
      >
        <el-menu-item index="/workspace">
          <el-icon><setting /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/report" >
          <el-icon><document /></el-icon>
          <span>数据统计</span>
        </el-menu-item>
        <el-menu-item index="/order">
          <el-icon><setting /></el-icon>
          <span>订单管理</span>
        </el-menu-item>

        <el-menu-item index="/setmeal">
          <el-icon><setting /></el-icon>
          <span>套餐管理</span>
        </el-menu-item>

        <el-menu-item index="/dish">
          <el-icon><setting /></el-icon>
          <span>菜品管理</span>
        </el-menu-item>

        <el-menu-item index="/category">
          <el-icon><setting /></el-icon>
          <span>分类管理</span>
        </el-menu-item>
        
        <el-menu-item index="/employee">
          <el-icon><setting /></el-icon>
          <span>员工管理</span>
        </el-menu-item>
      </el-menu>
        </el-aside>

<!-- main区域 -->
        <el-main style="background-color:#f3f4f7;">
          <div class="main">
          <router-view/>
          </div>
        </el-main>
      </el-container>
    </el-container>

    <!-- ===== 营业状态设置弹窗 ===== -->
    <!-- ✅ v-model 绑定 statusDialogVisible：true 显示、false 关闭；点右上角 X 或外面空白处也能关 -->
    <el-dialog v-model="statusDialogVisible" title="营业状态设置" width="420px">
      <div class="status-dialog-content">
        <p class="status-tip">请选择店铺营业状态</p>
        <div class="status-btn-group">
          <!-- ✅ 开店按钮：绿色（色值表"成功/启用"色）；点击把状态 1 发给后端 -->
          <div class="status-btn status-btn-open" @click="handleSetStatus(1)">
            <el-icon class="status-btn-icon"><Sunrise /></el-icon>
            <span>开店</span>
          </div>
          <!-- ✅ 打烊按钮：灰色（色值表"停用/禁用"色）；点击把状态 0 发给后端 -->
          <!-- ⚠️ 图标用 Sunrise（日出）/ MoonNight（月亮）：日出开门营业、月亮出来打烊，生活化好记 -->
          <div class="status-btn status-btn-closed" @click="handleSetStatus(0)">
            <el-icon class="status-btn-icon"><MoonNight /></el-icon>
            <span>打烊</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- ===== 来单/催单提醒卡片（固定在屏幕右上角的小长方形弹窗） ===== -->
    <!-- ✅ v-if 控制显示；点整张卡片跳去订单管理页；右上角 X 单独关闭（@click.stop 防止点 X 时也触发卡片跳转） -->
    <div v-if="tipVisible" class="order-tip-card" @click="goToOrder">
      <div class="order-tip-head">
        <!-- ✅ 新订单=黑字标题，催单=红字标题（红色代表紧急，色值表"危险"色） -->
        <span class="order-tip-title" :class="{ 'order-tip-title-urgent': orderTip.type === 2 }">
          {{ orderTip.type === 1 ? '新订单提醒' : '催单提醒' }}
        </span>
        <span class="order-tip-close" @click.stop="closeTip">✕</span>
      </div>
      <!-- ✅ 提醒正文：直接用后端发来的 content 文字（如"您有新的订单，订单号为:…"） -->
      <p class="order-tip-content">{{ orderTip.content }}</p>
      <div class="order-tip-footer">
        <!-- ✅ "去处理"黑色小按钮：和全站操作按钮风格一致（黑底白字，色值表） -->
        <span class="order-tip-btn">去处理</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header {
  height: 75px;
  background-color: #ffc100;
  display: flex;
  justify-content: space-between;  /* ✅ 左右分开 */
}
.header-left {
  display: flex;
  align-items: center;
  gap: 0px;  /* ✅ 按钮和标题间距 */
}

/* ===== 营业状态标签 ===== */
/* ✅ 公共形状：圆角、收缩背景、左边距（原来只有红色一种，现在红/灰两个状态共用这部分） */
.status-tag {
  border-radius: 8px !important;    /* ✅ 加圆角 */
  display: flex;
  margin-left: 30px !important;     /* ✅ 加外边距，让背景色收缩 */
}

/* ✅ 营业中 = 深红（色值表"危险/营业中"）+ 白字 */
.deep-red-tag {
  background-color: #ff0000 !important;
  border-color: #f5f2f2 !important;
  color: #ffffff !important;
}

/* ✅ 打烊中 = 灰（色值表"停用/禁用"）+ 黑字（灰底配黑字比白字清晰好读） */
.closed-tag {
  background-color: #bebcbc !important;
  border-color: #f5f2f2 !important;
  color: #000000 !important;
}

/* ===== 营业状态设置弹窗 ===== */
/* ✅ 弹窗内容整体居中，上下留一点呼吸空间 */
.status-dialog-content {
  text-align: center;
  padding: 10px 0 20px;
}

/* ✅ 弹窗里的提示文字 */
.status-tip {
  margin: 0 0 24px;
  font-size: 15px;
  color: #000000;
  font-family: 微软雅黑;
}

/* ✅ 两个大按钮横排、居中、中间留 20px 间距 */
.status-btn-group {
  display: flex;
  gap: 20px;
  justify-content: center;
}

/* ✅ 大按钮公共样式：圆角 8px（和全站胶囊统一）、图标和文字横排 */
.status-btn {
  width: 140px;
  height: 56px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  font-family: 微软雅黑;
  cursor: pointer;               /* ✅ 手型光标：告诉用户这里可以点 */
  transition: opacity 0.2s ease; /* ✅ 悬停变淡的渐变动画 */
  user-select: none;             /* ✅ 双击时不会把按钮文字选中成蓝色 */
}

/* ✅ 鼠标悬停：整颗按钮微微变淡，表示"可以按下"（用透明度，不引入表外新颜色） */
.status-btn:hover {
  opacity: 0.85;
}

/* ✅ 按钮里的图标稍微大一点，和文字搭配 */
.status-btn-icon {
  font-size: 20px;
}

/* ✅ 开店 = 绿底白字（色值表"成功/启用"） */
.status-btn-open {
  background-color: #67c23a;
  color: #ffffff;
}

/* ✅ 打烊 = 灰底黑字（色值表"停用/禁用"） */
.status-btn-closed {
  background-color: #bebcbc;
  color: #000000;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0px;  /* ✅ 按钮和标题间距 */
}

.statusSetting{
 color: #000000 !important;
  padding: 0 32px !important;
  height: 100% !important;     /* 占满容器高度 */
  border-radius: 0 !important;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 微软雅黑;
  font-weight: Medium;
  font-size: 15px;
  transition: background-color 0.2s ease;
}
.statusSetting:hover{
  background-color: rgba(255, 255, 255, 0.5) !important;
  color: #000000 !important;
}

.el-dropdown-link {
  cursor: pointer;
  background-color: #ffe185;
  border-radius: 4px !important;    /* ✅ 加圆角 */
  color: black;
  padding: 8px 10px !important;
  display: flex;
  align-items: center;
  gap: 30px !important;
  font-family: 微软雅黑;
  font-weight: Medium;
  font-size: 15px;
}


.aside {
  border-right: 1px solid #ccc;
  background-color: #343744;
  min-height: calc(100vh - 60px);
  transition: width 0.3s ease;   /* ✅ 宽度过渡动画 */
  overflow: hidden;              /* 防止内容溢出 */

}
/* 悬浮时 - 亮色 */
.aside .el-menu-item:hover {
  background-color: #4a5a7a !important;
}

/* 图标 */
.logo {
  height: 40px;      /* ✅ 限制高度 */
  width: auto;       /* 宽度自适应，保持比例 */
  margin-right: 8px; /* 和标题的间距 */
}

/* 点击/聚焦时 - 深色 */
.aside .el-menu-item:focus {
  background-color: #ffffff !important;
  color: #000000 !important;
    border-radius: 8px !important;    /* ✅ 加圆角 */
  margin: 4px 8px !important;       /* ✅ 加外边距，让背景色收缩 */
  width: auto !important;           /* ✅ 宽度自适应 */
}

/* ✅ 标题容器：上下排列 */
.title-wrapper {
  display: flex;
  flex-direction: column;   /* 上下排列 */
  line-height: 1.2;         /* 行间距紧凑 */
}

.Title {
  color: white;
  font-size: 28px;
  font-weight: bold;
  font-family: 楷体;
}

/* ✅ 英文副标题 */
.sub-title {
  color: rgba(255, 255, 255, 0.7);  /* 半透明白色，更柔和 */
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.5px;              /* 字母间距，更高级 */
  font-family: Arial, sans-serif;
}

.main{
  margin: 6px;
  padding: 30px;
  background-color: #ffffff;
}

/* ===== 来单/催单提醒卡片 ===== */
/* ✅ position: fixed 固定在屏幕右上角（不随页面滚动）；z-index 抬到比弹窗还高，永远在最上面 */
.order-tip-card {
  position: fixed;
  top: 90px;                    /* 顶栏 75px 高，往下留 15px 空隙，不压着顶栏 */
  right: 20px;
  width: 300px;                 /* "小长方形"：宽度固定 300px，高度由内容撑开 */
  background-color: #ffffff;    /* 白底（色值表"内容卡片"） */
  border: 2px solid #ffc100;    /* 金黄描边（色值表"品牌主色"）：显眼但和顶栏呼应 */
  border-radius: 8px;           /* 圆角 8px，和全站胶囊统一 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* 轻微阴影：让卡片"浮"在页面上方 */
  padding: 14px 16px;
  cursor: pointer;              /* ✅ 手型光标：整张卡片都可点击跳转 */
  z-index: 3000;                /* ✅ Element 弹窗是 2000 级，这里用 3000 保证永远在最上面 */
  animation: tip-slide-in 0.3s ease; /* ✅ 出现时从右侧滑入的小动画 */
}

/* ✅ 滑入动画：从屏幕右外侧（translateX 110%）滑到原位，像手机通知横幅一样 */
@keyframes tip-slide-in {
  from {
    transform: translateX(110%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* ✅ 卡片头部：标题在左、关闭按钮在右 */
.order-tip-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ✅ 标题：黑字加粗（色值表黑色） */
.order-tip-title {
  font-size: 16px;
  font-weight: bold;
  color: #000000;
  font-family: 微软雅黑;
}

/* ✅ 催单标题变红：红色 = 紧急（色值表"危险"色），一眼看出是客人在催 */
.order-tip-title-urgent {
  color: #ff0000;
}

/* ✅ 右上角关闭 X：灰色（色值表"停用/禁用"色），悬停变黑提示可点 */
.order-tip-close {
  color: #bebcbc;
  font-size: 14px;
  padding: 0 4px;
}
.order-tip-close:hover {
  color: #000000;
}

/* ✅ 提醒正文：后端发来的 content 文字 */
.order-tip-content {
  margin: 8px 0 12px;
  font-size: 14px;
  color: #000000;
  font-family: 微软雅黑;
  line-height: 1.5;
}

/* ✅ 底部右对齐，放"去处理"按钮 */
.order-tip-footer {
  text-align: right;
}

/* ✅ "去处理"黑色小按钮：黑底白字（色值表"黑底白字按钮"），悬停深灰 #333333 */
.order-tip-btn {
  display: inline-block;
  background-color: #000000;
  color: #ffffff;
  font-size: 13px;
  font-family: 微软雅黑;
  padding: 5px 16px;
  border-radius: 6px;
}
.order-tip-btn:hover {
  background-color: #333333;
}


</style>