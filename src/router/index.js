import { createRouter, createWebHistory } from 'vue-router'

import workspaceIndex from '../views/workSpace/index.vue'
import loginIndex from '../views/login/index.vue'
import layoutIndex from '../views/layout/index.vue'
import reportIndex from '../views/report/index.vue'
import orderIndex from '../views/order/index.vue'
import setmealIndex from '../views/setmeal/index.vue'
import dishIndex from '../views/dish/index.vue'
import categoryIndex from '../views/category/index.vue'
import employeeIndex from '../views/employee/index.vue' 

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {path: '/',
      name: '',
      component: layoutIndex,
      redirect:'/workspace',
      children:
    [
    {path: '/workspace',name: 'workspace',component: workspaceIndex},
    {path: '/report',name: 'report',component: reportIndex},
    {path: '/order',name: 'order',component: orderIndex},
    {path: '/setmeal',name: 'setmeal',component: setmealIndex},
    {path: '/dish',name: 'dish',component: dishIndex},
    {path: '/category',name: 'category',component: categoryIndex},
    {path: '/employee',name: 'employee',component: employeeIndex}
    ]
  },

    {path: '/login',name: 'login',component: loginIndex}
  ]
})

export default router
