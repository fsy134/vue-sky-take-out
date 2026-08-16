import request from "@/utils/request.js";

//分页查询api
export const getPage = (name,page,pageSize) =>request.get(`/employee/page?name=${name}&page=${page}&pageSize=${pageSize}`)

//新增员工
export const insertEmpApi=(data)=>request.post('/employee',data)

//通过id查询员工
export const searchByIdApi=(id)=>request.get(`/employee/${id}`)

//修改员工
export const editEmpApi=(data)=>request.put('/employee',data)

//修改员工状态
export const editEmpStatusApi=(id, status)=>request.post(`/employee/status/${status}?id=${id}`)
