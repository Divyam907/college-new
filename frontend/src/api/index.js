import axios from 'axios'

const api = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Teacher Auth
export const teacherLogin = (email, password) =>
  api.post('/api/auth/login', { email, password, role: 'teacher' })

export const teacherSignup = (name, email, password) =>
  api.post('/api/auth/signup', { name, email, password })

export const collegeLogin = (email, password) =>
  api.post('/api/auth/login', { email, password, role: 'college' })

export const checkAuth = () => api.get('/api/auth/me')

export const logout = () => api.post('/api/auth/logout')

// Teacher APIs
export const getBatches = () => api.get('/api/teacher/batches')
export const getBranches = (batchId) => api.get(`/api/teacher/branches?batch_id=${batchId || ''}`)
export const getClasses = (branchId, batchId) =>
  api.get(`/api/teacher/classes?branch_id=${branchId || ''}&batch_id=${batchId || ''}`)
export const getSections = (classId) => api.get(`/api/teacher/sections/${classId}`)
export const getPeriods = (sectionId) => api.get(`/api/teacher/periods/${sectionId}`)
export const getCameraStatus = (sectionId) => api.get(`/api/teacher/camera-status/${sectionId}`)

// Attendance
export const markAttendance = (photo, sectionId, periodId) =>
  api.post('/teacher/attendance/mark', { photo, section_id: sectionId, period_id: periodId })

// Liveness
export const enableLiveness = (sectionId, periodId, interval) =>
  api.post('/teacher/liveness/enable', new URLSearchParams({
    section_id: sectionId, period_id: periodId, interval: interval
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })

export const disableLiveness = (sessionId) =>
  api.post('/teacher/liveness/disable', new URLSearchParams({ session_id: sessionId }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export const captureLiveness = (photo, sessionId) =>
  api.post('/teacher/liveness/capture', { photo, session_id: sessionId })

// Reports
export const sendReport = (payload) => api.post('/teacher/reports/send', payload)

export const scheduleReport = (data) =>
  api.post('/teacher/reports/schedule', new URLSearchParams(data), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export const deleteSchedule = (id) =>
  api.post(`/teacher/reports/schedule/${id}/delete`, new URLSearchParams({}), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export const toggleSchedule = (id) =>
  api.post(`/teacher/reports/schedule/${id}/toggle`, new URLSearchParams({}), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export default api
