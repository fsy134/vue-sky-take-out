import request from '@/utils/request'

export const loginApi= (data) =>request.post('/employee/login',data)