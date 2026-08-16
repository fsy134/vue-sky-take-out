import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

const request =axios.create({
  baseURL:'/api',
  timeout:600000
})
// https://m1.apifoxmock.com/m1/8509061-8283326-default

request.interceptors.request.use(
  (config)=>{
    //获取在登录时储存在localstorage中存储的token
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) ;
    if(userInfo && userInfo.token){
      config.headers.token = userInfo.token;
    }
    return config;
  },
  (error)=>{
    return Promise.reject(error);
  }
)

request.interceptors.response.use(
  (response)=>{
    //解析response数据
    return response.data;
  },
  (error)=>{
    if(error.response.status === 401){
      //提示错误信息
      ElMessage.error('登录已过期，请重新登录')
      //跳转页面
      router.push('/login');
    }else{
      ElMessage.error('接口访问异常')
    }
    return Promise.reject(error);
  }
)

export default request