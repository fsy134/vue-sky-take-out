<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Expand, Fold,User, Lock, SwitchButton } from '@element-plus/icons-vue'

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

          <el-tag type="danger"class="deep-red-tag">
            营业中
          </el-tag>
        </div>

      <div class="header-right">
          <el-button type="text" style="color: black;" class="statusSetting"><el-icon><Shop /></el-icon><span>营业状态设置</span></el-button>
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

/* tag标签样式 */
.deep-red-tag {
  background-color: #ff0000 !important;
  border-color: #f5f2f2 !important;
    border-radius: 8px !important;    /* ✅ 加圆角 */
  color: #ffffff !important;
  display: flex;
  margin-left: 30px !important;       /* ✅ 加外边距，让背景色收缩 */
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


</style>