<script setup>
  import { ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { loginApi } from '@/api/login.js'
  import { useRouter } from 'vue-router'

  const router=useRouter();

  let loginForm = ref({username:'', password:''})
  
  const login=async()=>{
    const result=await loginApi(loginForm.value);
    if(result.code){
      //1.返回成功登录信息
      ElMessage.success('欢迎回来');
      //2.存储用户信息在浏览器
      localStorage.setItem('userInfo',JSON.stringify(result.data));
      //3.跳转到首页
      router.push('/workspace');
    }else{
      ElMessage.error(result.msg);
    }
  }

  
  const clear=()=>{
    loginForm.value={username:'', password:''};
  }
</script>

<template>
  <div id="container">
    <div class="login-form">
      <!-- ✅ 店铺头像图：圆形展示（像微信头像），放在账号输入框上方，比文字标题更醒目 -->
      <img class="login-avatar" src="../../assets/登录页背景.jpg" alt="烧烧餐厅头像" />
      <el-form label-width="80px">
        <p class="title">烧烧餐厅</p>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入用户名"></el-input>
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input type="password" v-model="loginForm.password" placeholder="请输入密码"></el-input>
        </el-form-item>

        <el-form-item>
          <el-button class="button" type="primary" @click="login()">登 录</el-button>
          <el-button class="button" type="info" @click="clear()">重 置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
/* ✅ 页面容器：白色背景 + 撑满整个窗口 + 弹性布局，让登录卡片在页面正中央（用户拍板：四周白色、简约风） */
#container {
  min-height: 100vh;              /* 撑满浏览器窗口高度（原来只有 410px，卡片挤在上方） */
  display: flex;                  /* 弹性布局：让里面的卡片能轻松居中 */
  align-items: center;            /* 垂直居中 */
  justify-content: center;        /* 水平居中 */
  background-color: #ffffff;      /* 四周纯白（原来的整页背景图方案已撤掉，图改放卡片里当头像） */
}

/* ✅ 登录卡片：白底、细边框、轻阴影，简约不厚重 */
.login-form {
  width: 400px;
  padding: 40px 30px 30px;
  text-align: center;             /* 卡片内容全部居中（头像、标题、表单） */
  border: 1px solid #e0e0e0;      /* 浅灰细边框 */
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.08); /* 轻阴影（原来 0.5 太重，简约风调淡），让卡片微微浮起 */
  background-color: #ffffff;
}

/* ✅ 圆形头像图：object-fit 把整张图按比例塞进圆形里，超出部分裁掉、画面不变形 */
.login-avatar {
  width: 150px;
  height: 150px;
  border-radius: 50%;             /* 50% 圆角 = 正圆形（头像风，用户拍板） */
  object-fit: cover;              /* 图片按比例填满圆形，多出来的边裁掉 */
  margin-bottom: 16px;            /* 和下方标题留点间距 */
}

.title {
  font-size: 30px;
  font-family: '楷体';
  text-align: center;
  margin-bottom: 30px;
  font-weight: bold;
}

.button {
  margin-top: 30px;
  width: 120px;
}
</style>