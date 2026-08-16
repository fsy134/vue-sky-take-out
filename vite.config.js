import { fileURLToPath, URL } from 'node:url'


//按需引入，优化性能
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// 引入需要的插件
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'



// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(),AutoImport({
      // 自动导入 Vue 相关 API，比如 ref, reactive 等
      imports: ['vue', 'vue-router'],
      resolvers:  [
        ElementPlusResolver({
          // 按需加载样式
          importStyle: 'css',
        }),
      ]
  
    }),
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'css',
        }),
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
   // 开发服务器配置
  server: {
    port: 5200,           // 端口号
    open: true,           // 自动打开浏览器
    proxy: {
      // 接口代理配置，解决跨域问题
      '/api': {
        target: 'http://localhost:8080/admin',  // 后端接口地址
        changeOrigin: true,                // 允许跨域
        rewrite: (path) => path.replace(/^\/api/, ''), // 可选：重写路径
      }
    }
  }
})



