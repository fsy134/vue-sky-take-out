<script setup>
import { ref,onMounted } from 'vue'
import {getPage,insertEmpApi,searchByIdApi,editEmpApi,editEmpStatusApi} from '@/api/emp.js'
import { ElMessage } from 'element-plus'

// 分页参数
const currentPage = ref(1)
const pageSize = ref(10)
const background = 'true'
const total = ref(0)

//对话框
const dialogFormVisible=ref(false)
const dialogTitle=ref('')

// ========== 表单引用 ==========
const formRef = ref(null)  // ✅ 新增
// 查询条件
const empName = ref('')

//分页查询
const search=async ()=>{
  const result= await getPage(empName.value,currentPage.value,pageSize.value);
  if(result.code){
    empList.value=result.data.records;
    total.value=result.data.total;
  }
}
//表格数据
const empList = ref([])

// 页面大小改变
const handleSizeChange = (val) => {
  console.log(`每页展示${val}条数据 `);
  search();
}
// 当前页码改变
const handleCurrentChange = (val) => {
  console.log(`当前页码: ${val}`);
  search();
}


//员工表单对象
const employeeForm=ref(
  {
  "id": '',
  "username": "",
  "name": "",
  "phone": "",
  "sex": "",
  "idNumber": "",
}
)
//新增员工
const addEmp=()=>{
dialogFormVisible.value=true;
dialogTitle.value='新增员工'
}

//表单规则
const formRules=({
  //账号
  username:[
    {required:true,message:'请输入姓名',trigger:'blur'},
    {min: 3, max: 20, message: '账号长度为3-20位', trigger: 'blur'},
  ],
  // 姓名
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  // 手机号
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  // 性别
  sex: [
    { required: true, message: '请选择性别', trigger: 'change' }
  ],
  // 身份证号
  idNumber: [
    { required: true, message: '请输入身份证号', trigger: 'blur' },
    { pattern: /^\d{17}[\dXx]$/, message: '请输入正确的身份证号', trigger: 'blur' }
  ]
})

//关闭表单
const handleDialogClosed=()=>{
   // ✅ 先关闭对话框
  dialogFormVisible.value = false
  // ✅ 再重置表单（用 nextTick 延迟执行）
  nextTick(() => {
    employeeForm.value={
  "id": '',
  "username": "",
  "name": "",
  "phone": "",
  "sex": "",
  "idNumber": "",
}
formRef.value?.resetFields()
  })
}

//查询回显
const editEmp=async (id)=>{
  const result =await searchByIdApi(id);
  if(result.code){
    employeeForm.value=result.data;
    dialogFormVisible.value=true;
    dialogTitle.value='修改员工信息';
  }else{
    ElMessage.error('查询失败')
  }
}

//提交表单
const handleSubmit=async()=>{
  if (!formRef) return;
  await formRef.value.validate(async (valid)=>{
    if(valid){
      let result;
      if(employeeForm.value.id){
        result=await editEmpApi(employeeForm.value);
      }else{
        result=await insertEmpApi(employeeForm.value);
      }

      
      if(result.code===1){
        console.log('进入了成功分支！')  // ✅ 加这行
        dialogFormVisible.value=false;
        ElMessage.success('提交成功');
        search();
      }else{
        console.log('进入了失败分支！')  // ✅ 加这行
        ElMessage.error(result.msg)
      }
    }else{
      ElMessage.error('请完善表单项')
    }
  })
  
}

//修改员工状态
const editEmpStatus=async(id,status)=>{
  const action= status===1?'启用':'禁用';
  const result=await editEmpStatusApi(id,status) ;
  if(result.code){
    ElMessage.success(`${action}成功`)
    search();
  }else{
    ElMessage.error(result.msg)
  }
}

onMounted(() => {
  search();
})
</script>

<template>
 <!-- 员工姓名查询,员工新增表单 -->
  <el-row class="row1" :gutter="15">
   <el-col :span="1" >
      <div class="container">
        <el-text class="text1" >员工姓名:</el-text>
      </div>
    </el-col>

     <el-col :span="4">
      <div class="container">
      <el-input v-model="empName" style="width: 280px;height:40px;margin-left: 10px;" placeholder="请输入员工姓名" clearable />
      </div>
    </el-col>

     <el-col :span="2">
       <el-button type="text" style="background-color: black;color:white;padding:5px 15px;border-radius: 6px;" @click="search()">查询</el-button>
    </el-col>
     <el-col :span="15">
      
    </el-col>
     <el-col :span="2" >
      <el-button type="text" style="background-color: #ffc200;color:black;padding:20px 15px;border-radius: 6px;margin-left:30px;" @click="addEmp()">+添加员工</el-button>
    </el-col>
  </el-row>

<!-- 员工列表表格 -->
 <div class="container">
  <el-table :data="empList" stripe  style="width: 100%; margin-top:20px;margin-bottom:20px;font-size: medium;font-family: '微软雅黑';color: black;" 
  :row-style="{ height: '50px' }"   
>
    <el-table-column prop="name" label="员工姓名" min-width="150" align="center"/>
    <el-table-column prop="username" label="账号" min-width="150" align="center"/>
    <el-table-column prop="phone" label="手机号" min-width="150" align="center" />
    <el-table-column prop="status" label="账号状态" min-width="150" align="center">
      <template #default="scope">
        <span class="status-text">
      <span 
        class="dot"
        :class="scope.row.status === 1 ? 'dot-green' : 'dot-grey'"
      />
      {{ scope.row.status === 1 ? '启用' : '停用' }}
    </span>
      </template>
    </el-table-column>
    <el-table-column prop="updateTime" label="最后操作时间" min-width="150" align="center"/>
    <el-table-column label="操作" min-width="150" align="center">
      <template #default="scope">
          <el-button type="primary" size="small" @click="editEmp(scope.row.id)"style="margin-right:10px;" :disabled="scope.row.username==='admin'" >修改</el-button>
          <span v-if="scope.row.status==1">
            <el-button type="danger" size="small" @click="editEmpStatus(scope.row.id,0)" :disabled="scope.row.username==='admin'">禁用</el-button>
          </span>
          <span v-if="scope.row.status==0">
            <el-button type="success" size="small" @click="editEmpStatus(scope.row.id,1)"  :disabled="scope.row.username==='admin'">启用</el-button>
            </span>
        </template>
    </el-table-column>
  </el-table></div>


  <!-- 分页条 -->
<!-- 分页组件 -->
  <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[5, 10, 20, 30, 40, 75]"
    layout="total, sizes, prev, pager, next, jumper" :total=total background="background"
    @size-change="handleSizeChange" @current-change="handleCurrentChange" style=" justify-content:center; " />

<!-- 新增员工或修改员工表单对话框 -->
<el-dialog 
  v-model="dialogFormVisible" 
  :title="dialogTitle"
  width="800px"
  style="padding:50px 20px;;"
  align-center
  center
  @closed="handleDialogClosed()"
>
  <!-- 表单项靠左 -->
  <el-form 
    ref="formRef"
    :model="employeeForm" 
    :rules="formRules"
    label-width="100px"
    style="padding-left: 170px;"
  >
    <el-form-item label="账号" prop="username">
      <el-input v-model="employeeForm.username" placeholder="请输入账号" style="width: 320px;" />
    </el-form-item>
    
    <el-form-item label="姓名" prop="name">
      <el-input v-model="employeeForm.name" placeholder="请输入姓名" style="width: 320px;" />
    </el-form-item>
    
    <el-form-item label="手机号" prop="phone">
      <el-input v-model="employeeForm.phone" placeholder="请输入手机号" style="width: 320px;" />
    </el-form-item>
    
    <el-form-item label="性别" prop="sex">
      <el-radio-group v-model="employeeForm.sex">
        <el-radio label="男">男</el-radio>
        <el-radio label="女">女</el-radio>
      </el-radio-group>
    </el-form-item>
    
    <el-form-item label="身份证号" prop="idNumber">
      <el-input v-model="employeeForm.idNumber" placeholder="请输入身份证号" style="width: 320px;" />
    </el-form-item>
    
    
  </el-form>
  
  <!-- 按钮居中 -->
  <template #footer>
    <div style="display: flex; justify-content: center; gap: 12px;">
      <el-button @click="dialogFormVisible = false">取消</el-button>
      <el-button type="primary"  @click="handleSubmit">
        提交
      </el-button>
    </div>
  </template>
</el-dialog>
</template>

<style scoped>
.container{
  margin:0px,5px;
  display:flex;
  align-items:center;

}

.text1{
  font-size:16px;
  font-family:"微软雅黑";
  color:#333;
  white-space: nowrap; /* 防止文字换行 */
}
.row1{
  /* gap:15px; */
  display:flex;
  align-items:center;
}



/* 状态的小绿点 */
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-green {
  background-color: #67c23a;
}

.dot-grey {
  background-color: #bebcbc;
}

</style>