# CLAUDE.md ——「烧烧餐厅」后台管理系统前端 · 开发运行规划

> 本文档是本项目的"施工图纸"：记录技术架构、配色方案、代码规范，以及最重要的开发工作流规则。
> 每次新会话 Claude 都会自动读取本文件，请严格遵守。本文档随开发进度持续更新（更新方式见第 5 章）。

## 1. 项目简介

- 本项目是"烧烧餐厅"点餐后台管理系统的**前端**（Vue 3 教学项目），后端为 Java 服务（sky-take-out），通过 vite 代理对接。
- **当前状态**：已完成登录页、主布局（layout）、员工管理、分类管理、菜品管理、套餐管理；剩余 3 个页面待开发（见第 6 章清单）。
- 用户是**编程新手**，所有新代码必须带中文注释 + ✅ 标记要点，注释要讲"是什么、为什么"，以新手能看懂为标准。

## 2. 开发铁律速览（不可违反）

> 三条铁律是最高优先级规则，任何情况下都要遵守，详见对应章节。

- **铁律 1（一次一组件）**：同一时间只开发**一个** views 页面组件；该组件经用户审查通过并提交 git 后，才能开始下一个。详见第 5 章。
- **铁律 2（git 门禁）**：用户明确说"通过/没问题"之前，**不得提交 git、不得开始下一个组件**。详见第 5 章。
- **铁律 3（注释规范）**：新代码一律中文注释 + ✅ 标记要点，注释占比不低于 30%（用户可用"检查注释"做体检）。详见第 8 章。

**📌 当前进度**：进行中页面 = 订单管理（开发中）；套餐管理已完成（用户审查通过并已提交 git）。每次组件完成提交后，同步更新本行与第 6 章清单。

## 3. 快速开始（怎么把项目跑起来）

1. 后端已部署到**微信云托管**（2026-08-20），前端直接跑就行；如需改回本地后端，把 `vite.config.js` 代理 target 换回 `http://localhost:8080/admin` 并启动本地 Java 服务。
2. 首次运行前端：`npm install`（装依赖）→ `npm run dev`（启动，自动打开 http://localhost:5200）。
3. 登录账号：管理员账号密码 = `admin` / `123456`。
4. 构建发布：`npm run build`（打包）；`npm run preview`（本地预览打包结果，端口 4173）。

**代理说明**（新手了解即可）：前端请求都发到 `/api` 开头，vite 会自动转发到云托管域名 `https://shaoshaocanting2-300150-11-1472054049.sh.run.tcloudbase.com/admin` 并去掉 `/api` 前缀（配置在 `vite.config.js`）。改后端地址只改这一个文件；WebSocket 的 `/ws` 同样在此文件配置，指向云端 `wss://` 域名。

**登录态说明**：登录成功后用户信息（含 token）存在浏览器 localStorage 的 `userInfo` 里；之后每次请求由 `src/utils/request.js` 自动带上 token；token 失效（401）会自动弹提示并跳回登录页。

## 4. 技术架构与目录规范

### 4.1 技术栈（保持现状，不要引入新技术）

| 技术 | 版本/说明 |
|---|---|
| Vue | 3.2（组合式 API + `<script setup>` 语法糖） |
| 构建工具 | Vite 3 |
| UI 组件库 | Element Plus 2.14（**完整引入** + 中文 locale + 全量图标全局注册） |
| 路由 | Vue Router 4（createWebHistory） |
| 请求 | axios 1.x（统一封装在 `src/utils/request.js`） |

**⚠️ 不要引入**：Pinia（无全局状态库，页面用 ref 自管理）、TypeScript（纯 JS）、ESLint/Prettier（保持现状）。

**易混淆点**：`vite.config.js` 里虽配置了按需导入插件（unplugin-auto-import / unplugin-vue-components），但项目实际走的是 `main.js` **完整引入** Element Plus 路线。因此：`el-xxx` 组件标签**无需 import 直接可用**；但 vue 的 API（ref、onMounted 等）**必须手动 import**（与现有页面写法一致）。

### 4.2 目录职责表

| 路径 | 职责 | 规范 |
|---|---|---|
| `src/api/xxx.js` | 接口文件，一个业务模块一个文件 | 函数一律 `xxxApi` 结尾（现有例外：emp.js 的 `getPage`，不改，新代码遵守规范） |
| `src/utils/request.js` | axios 封装（baseURL `/api`、自动带 token、401 跳登录） | 页面**禁止直接 import axios**，一律走 api 模块函数；响应拦截器已返回 `response.data`，页面里 `const result = await xxxApi()` 后直接取 `result.data`、判断 `result.code` |
| `src/views/xxx/index.vue` | 页面，每页一个文件夹 | 6 个占位页已建好，后续工作是填充 |
| `src/router/index.js` | 集中路由 | layout 父路由 + 7 子路由 + /login，**已全部注册好** |
| `src/views/layout/index.vue` | 主布局（金黄顶栏 + 深色侧边菜单 + 白卡片主区） | 菜单项已全部添加（`:router="true"`，`index` 即路由路径） |
| `src/assets/main.css` | 全局样式 | 全局重置 + 全站表格统一样式；主题说明见第 7.2 节 |
| `src/components/` | 公共组件目录 | 目前为空，预留 |

## 5. 开发工作流（一次一组件 + git 门禁）★核心章节

### 5.1 术语定义

- **"一个组件"** = 一个 views 页面，含它对应的 `api/xxx.js` 文件（本项目路由和菜单已就绪，通常只需填充 `index.vue` + 新建 api 文件）。
- **"完成"** = 用户审查通过 **且** 已提交 git。两个条件缺一不可。

### 5.2 标准流程（每个组件必须完整走完 4 步）

**第 1 步：开工确认**
- Claude 做：先查看第 2 章「当前进度」确认进行中的页面；若用户直接指定了页面，与第 6 章清单的依赖顺序核对，不一致时向用户确认，不擅自改序。
- Claude 不做：不一次性创建多个页面的文件；不在用户未确认时自行扩大页面范围。

**第 2 步：只开发该页面**
- 只创建/修改本组件相关文件（`views/xxx/index.vue`、`api/xxx.js`）。
- **不顺手修改任何其他页面的代码**；发现其他页面有问题时，记入第 11 章「已知问题待办」，不修。
- 开发完成后自查一遍：模板无报错、接口路径与后端一致、注释齐全（≥30%）、颜色来自第 7 章色值表、无残留调试代码（console.log 等，教学演示需要保留时加 ✅ 注释说明）。

**第 3 步：提请审查，停手等待**
- 汇报内容：本页面实现了哪些功能、改了/新建了哪些文件、自查结果。
- 结尾必须明确询问："请审查 xxx 页面，你说通过后我才会提交 git 并进入下一个页面。"
- 提交审查后**停止开发**。**禁止在等待用户回复期间开始写下一个页面的任何代码。**

**第 4 步：审查通过 → 提交 → 更新清单**
- 用户确认通过后：执行 git 提交（可用 /git-save），提交信息格式：`feat: 完成分类管理页面`。
- 提交后同步更新本文件：第 2 章「当前进度」指向下一个页面、第 6 章清单勾选该项为已完成。本文件的更新与组件代码放入**同一次提交**。
- 最后询问用户是否继续下一个页面，得到确认才开工，否则停手。

### 5.3 审查不通过时

- 只修改用户指出的问题，改完再次汇报并提请审查，循环至通过。
- 修改期间同样**不得**开发其他页面。

### 5.4 独立小任务规则（不属于"做组件"）

- 修 bug、主题改造等已排定任务（第 11 章）可单独进行，**不受"一次一组件"限制**，但必须**单独提交**（提交信息 `fix:` 开头），不得混入页面组件的提交。
- 用户在组件审查期以外随时可以发起小任务。

### 5.5 提交门禁提示

- 本项目装了"提交门卫"（.claude/hooks/commit-gate.mjs）：git 提交需要新鲜的质检标记（测试通过标记 + 质量通过标记，有效期 1 小时）。
- 用户提交时若被拦截，按提示先跑对应检查（见第 12 章）再提交。

## 6. 剩余页面开发清单

状态三态：**待开发 / 进行中**（同一时间只能有一个）/ **已完成**（审查通过并已提交 git）。

**开发顺序固定，不可调换**：分类 → 菜品 → 套餐 → 订单 → 统计 → 工作台
（依赖原因：菜品要选分类；套餐要选分类和菜品；订单展示菜品/套餐；统计基于订单数据；工作台聚合所有模块，放最后）

- [x] 1. 分类管理（`views/category`）——已完成——依赖：无
- [x] 2. 菜品管理（`views/dish`）——已完成——依赖：分类
- [x] 3. 套餐管理（`views/setmeal`）——已完成——依赖：分类、菜品
- [ ] 4. 订单管理（`views/order`）——进行中——依赖：菜品、套餐
- [ ] 5. 数据统计（`views/report`）——待开发——依赖：订单
- [ ] 6. 工作台（`views/workSpace`）——待开发——依赖：全部

更新规则：**仅在工作流第 4 步 git 提交后**，由 Claude 把对应行改为 `[x] 已完成` 并更新第 2 章「当前进度」。

## 7. 配色与样式规范

### 7.1 设计色值表（全站唯一颜色来源，按用途查找）

| 用途 | 色值 | 备注 |
|---|---|---|
| 品牌主色（顶栏背景） | `#ffc100` | 金黄，全站主色 |
| 辅助黄（胶囊标签） | `#ffe185` | 如 layout 管理员下拉胶囊 |
| 菜单激活字色 | `#ffd04b` | 侧边栏 el-menu active-text-color |
| 侧边栏背景 | `#343744` | 深蓝灰 |
| 侧边栏 hover | `#4a5a7a` | 深蓝灰提亮 |
| 侧边栏激活项 | 白底 `#ffffff` + 黑字 | 圆角 8px 浮起效果 |
| 页面底色 | `#f3f4f7` | el-main 背景 |
| 内容卡片 | `#ffffff` | 白卡片 + 圆角 |
| 成功 / 启用 | `#67c23a` | 对应 Element Plus success（启用文字按钮也用） |
| 危险 / 营业中 | `#ff0000` | 深红 tag |
| 停用 / 禁用 | `#bebcbc` | 灰 |
| 黑底白字按钮（查询/新增/确定） | 底 `#000000` 字 `#ffffff` | 悬停底 `#333333` |
| 文字按钮·修改 | `#409eff` | 蓝（EP 默认蓝） |
| 文字按钮·删除/禁用 | `#f56c6c` | 红（EP danger） |

**字体与圆角**：大标题楷体 28px 加粗、正文微软雅黑、辅助英文 Arial；圆角统一 6–10px（tag/胶囊 8px）。

### 7.2 主题说明（2026-08-17 用户试用后拍板）

- 曾试装"全局金黄主色覆盖"（`--el-color-primary: #ffc100`），用户试用后认为金黄按钮不好看，**已撤掉**。
- 现保持 Element Plus **默认蓝色主题**，不再做任何全局主色覆盖（main.css 里留了说明注释，不要再加回来）。
- 金黄 `#ffc100` 仅保留在用户自己设计的顶栏、侧边菜单（layout 页面）里。
- 按钮配色按第 9 章「按钮规范」执行。
- **规范条款**：新页面**禁止硬编码颜色**；确需新颜色时先登记到 7.1 表再使用；现有页面的硬编码颜色不强制立即重构，随各页开发顺带替换。

## 8. 组件代码规范

- 一律 `<script setup>` 组合式 API；vue API 手动 import（`import { ref, onMounted } from 'vue'`），与 employee/layout 保持一致。
- **注释规范**：中文注释、✅ 标记要点、占比不低于 30%；注释讲"这行是干什么的、为什么"，以新手看懂为准。
- **命名约定**：页面文件夹小驼峰（workSpace）；API 函数 `xxxApi`；表单 ref 以 Ref 结尾（formRef）；事件处理 `handleXxx`（handleSizeChange、handleCurrentChange）。
- **页面结构顺序**：`<script setup>` → `<template>` → `<style scoped>`。
- **表格标准样式（全站统一，用户拍板）**：全局 main.css 已定义 el-table 统一 14px / 微软雅黑 / 黑字；页面表格统一用 stripe 斑马纹 + `:row-style` 行高 50px；**不要再写 font-size 内联样式**（写了会挡住全局规则，导致各页表格不一致）。
- **标准 CRUD 模板**：`src/views/employee/index.vue`（搜索栏 + 表格 + 分页 + 弹窗表单 + rules 校验 + ElMessage），新页面照此骨架改字段，这是全项目唯一权威模板。
- **提交前自查清单**：模板渲染无报错 / 接口路径与后端一致 / 注释齐全 / 颜色来自 7.1 表 / 调试代码已清理。

## 9. Element Plus 使用规范

- `el-xxx` 组件标签全局可用，**不需要** import 组件或样式（main.js 完整引入）。
- **图标**：模板内直接 `<el-icon><Plus /></el-icon>`（已全局注册全部图标）；在 script 中做 `:icon` 动态绑定时需手动 import（参照 layout 的 `import { Expand, Fold } from '@element-plus/icons-vue'`）。
- 中文 locale 已全局配置，日期、分页等默认中文。
- 轻提示统一 `ElMessage`（需手动 import：`import { ElMessage } from 'element-plus'`）。
- **按钮规范（用户拍板）**：查询、新增、弹窗"确定"等操作按钮 = 黑底白字（类名 `btn-black`，悬停深灰 `#333`）；表格"操作"列 = 无底色文字按钮：修改=蓝 `#409eff`、删除=红 `#f56c6c`、禁用=红 `#f56c6c`、启用=绿 `#67c23a`（类名 `btn-text` + `btn-text-blue/red/green`）。
- 表单校验标准写法：`el-form :model :rules ref` + 提交时 `formRef.value.validate()`（**注意 `.value`**，本项目踩过这个坑）。
- 分页与后端约定：`page` / `pageSize` query 参数，返回 `{ records, total }`。
- **主题保持 Element Plus 默认蓝**；配色统一走第 7 章色值表和第 9 章按钮规范，不要在组件里随意硬编码颜色。

## 10. 开发套路（新增页面 / 新增 API 的固定步骤）

### 套路 A：填充一个页面（本项目最常用）

路由和菜单**已全部就绪**，只需两步：
1. 建 `src/api/xxx.js`（照套路 B）。
2. 填充 `src/views/xxx/index.vue`（照 employee 骨架：搜索 → 表格 → 分页 → 弹窗表单）。
3. （仅新页面才需要）`src/router/index.js` 加路由 + `layout/index.vue` 加菜单项，`index` 必须等于路由 path。

### 套路 B：新增 API 文件（三步模板）

1. 新建 `src/api/xxx.js`，首行 `import request from "@/utils/request.js"`。
2. 每个接口导出一个 `xxxApi` 函数（参照 emp.js 与后端 sky-take-out 约定）：
   - 分页查询：`export const xxxPageApi = (name,page,pageSize) => request.get('/xxx/page?name=${name}&page=${page}&pageSize=${pageSize}')`
   - 新增：`request.post('/xxx', data)`；按 id 查：`request.get('/xxx/${id}')`；修改：`request.put('/xxx', data)`；状态切换：`request.post('/xxx/status/${status}?id=${id}')`
3. 页面侧：`import { xxxApi } from '@/api/xxx.js'` → `const result = await xxxApi(...)` → 成功 `result.code` 为 1 → `ElMessage.success('...')`，失败 `ElMessage.error(result.msg)`。

### 套路 C：加一个路由（仅新页面才需要）

`src/router/index.js` 顶部 import 组件 + layout 的 children 数组加一条 `{path, name, component}`；再到 `layout/index.vue` 菜单加 `el-menu-item`（`index` = path）。

## 11. 已知问题待办

| # | 问题 | 位置 | 优先级 / 建议时机 |
|---|---|---|---|
| 1 | layout 的 `handleCommand` 未定义，退出登录/修改密码无效 | `src/views/layout/index.vue` | ✅ 已解决（98ff5ab 提交） |
| 2 | 金黄主题变量覆盖 | `src/assets/main.css` | ✅ 已解决：改回默认蓝（见 7.2），98ff5ab 提交 |
| 3 | login 引用的 `src/assets/bg1.jpg` 不存在，登录页背景空白 | `src/views/login/index.vue` | P1：补图或去掉背景 |
| 4 | 无路由守卫，未登录可直接访问 /employee 等内页 | `src/router/index.js` | P1：建议做工作台前补 `beforeEach`（检查 localStorage token） |
| 5 | employee 的 `nextTick` 未导入；`if (!formRef)` 应为 `formRef.value` | `src/views/employee/index.vue` | P2：下次审查 employee 时顺手修，独立提交 |
| 6 | emp.js 的 `getPage` 未按 `xxxApi` 命名 | `src/api/emp.js` | P3：不改现状，新代码遵守规范 |
| 7 | WebSocket 无心跳（云端约 60 秒空闲断连）、退出登录后僵尸重连 | `src/views/layout/index.vue` | ✅ 已解决：加 30 秒心跳 + 主动关闭标记（后端部署云托管配套 fix 提交） |

**联动规则**：
- 修 bug 是独立小任务，不受"一次一组件"限制，但必须独立提交（`fix:` 开头），不得混入页面组件提交。
- 开发任何页面时发现新问题：只记录到本表，**不顺手修**。
- 每解决一项就更新本表状态（解决 / 关闭），随该次提交一起走。

## 12. 附录：可用检查工具

- 用户说"检查注释"或 `/comments-check`：注释体检（占比 ≥30%），建议每个组件提交前自查或请用户跑一次。
- 用户说"保存进度"/"提交"/`/git-save`：提交并推送（工作流第 4 步使用）。
- 用户说"安全检查"/"查漏洞"：安全体检（含依赖包漏洞查询）。
- 用户说"单元测试"/"给代码体检"：生成并执行测试。
- 备注：Claude 不主动触发这些检查，除非用户要求或工作流要求。
