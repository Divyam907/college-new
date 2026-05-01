import axios from 'axios'

// In production (Render), VITE_API_URL is set to the backend service URL.
// In development, it's empty and Vite proxies /api to localhost:5000.
export const API_BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

export default api

// ── Teacher helper functions ──────────────────────────────────────────────────

export const getBatches = () => api.get('/api/teacher/batches')

export const getBranches = (batchId) =>
  api.get('/api/teacher/branches', { params: { batch_id: batchId } })

export const getClasses = (branchId, batchId) =>
  api.get('/api/teacher/classes', { params: { branch_id: branchId, batch_id: batchId } })

export const getSections = (classId) =>
  api.get('/api/teacher/sections', { params: { class_id: classId } })

export const getPeriods = (sectionId) =>
  api.get('/api/teacher/periods', { params: { section_id: sectionId } })

export const markAttendance = (photo, sectionId, periodId) =>
  api.post('/api/teacher/mark-attendance', { photo, section_id: sectionId, period_id: periodId })

export const getCameraStatus = (sectionId) =>
  api.get('/api/teacher/liveness/status', { params: { section_id: sectionId } })

export const enableLiveness = (sectionId) =>
  api.post('/api/teacher/liveness/enable', { section_id: sectionId })

export const disableLiveness = (sectionId) =>
  api.post('/api/teacher/liveness/disable', { section_id: sectionId })

export const captureLiveness = (sectionId) =>
  api.post('/api/teacher/liveness/capture', { section_id: sectionId })

export const sendReport = (sectionId, dateFrom, dateTo, sendToAuthorities, sendToParents) =>
  api.post('/api/teacher/send-report', {
    section_id: sectionId,
    date_from: dateFrom,
    date_to: dateTo,
    send_to_authorities: sendToAuthorities,
    send_to_parents: sendToParents,
  })

export const scheduleReport = (sectionId, frequency, time, includeParents) =>
  api.post('/api/teacher/report-schedules', {
    section_id: sectionId,
    frequency,
    time,
    include_parents: includeParents,
  })

export const deleteSchedule = (id) => api.delete(`/api/teacher/report-schedules/${id}`)

export const toggleSchedule = (id) => api.put(`/api/teacher/report-schedules/${id}/toggle`)
