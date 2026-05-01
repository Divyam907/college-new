import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from './api'
import ThemeProvider from './components/ThemeProvider'
import TeacherLogin from './pages/teacher/TeacherLogin'
import CollegeLogin from './pages/college/CollegeLogin'
import TeacherLayout from './components/TeacherLayout'
import CollegeLayout from './components/CollegeLayout'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherAttendance from './pages/teacher/TeacherAttendance'
import TeacherLiveness from './pages/teacher/TeacherLiveness'
import TeacherEngagement from './pages/teacher/TeacherEngagement'
import TeacherReports from './pages/teacher/TeacherReports'
import CollegeDashboard from './pages/college/CollegeDashboard'
import CollegeStructure from './pages/college/CollegeStructure'
import CollegeTimetable from './pages/college/CollegeTimetable'
import CollegeTeachers from './pages/college/CollegeTeachers'
import CollegeStudents from './pages/college/CollegeStudents'
import CollegeAttendance from './pages/college/CollegeAttendance'
import CollegeLiveness from './pages/college/CollegeLiveness'

function App() {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    axios.get('/api/auth/me').then(r => {
      setUser(r.data)
      sessionStorage.setItem('user', JSON.stringify(r.data))
    }).catch(() => {})
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    sessionStorage.setItem('user', JSON.stringify(userData))
  }

  const handleLogout = async () => {
    await axios.post('/api/auth/logout').catch(() => {})
    setUser(null)
    sessionStorage.removeItem('user')
  }

  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Navigate to="/teacher/login" />} />
        <Route path="/teacher/login" element={<TeacherLogin onLogin={handleLogin} />} />
        <Route path="/college/login" element={<CollegeLogin onLogin={handleLogin} />} />

        {/* Teacher Portal */}
        <Route path="/teacher" element={
          user?.role === 'teacher' ? <TeacherLayout user={user} onLogout={handleLogout} /> : <Navigate to="/teacher/login" />
        }>
          <Route index element={<TeacherDashboard />} />
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="attendance" element={<TeacherAttendance />} />
          <Route path="liveness" element={<TeacherLiveness />} />
          <Route path="engagement" element={<TeacherEngagement />} />
          <Route path="reports" element={<TeacherReports />} />
        </Route>

        {/* College Portal */}
        <Route path="/college" element={
          user?.role === 'college' ? <CollegeLayout user={user} onLogout={handleLogout} /> : <Navigate to="/college/login" />
        }>
          <Route index element={<CollegeDashboard />} />
          <Route path="dashboard" element={<CollegeDashboard />} />
          <Route path="structure" element={<CollegeStructure />} />
          <Route path="timetable" element={<CollegeTimetable />} />
          <Route path="teachers" element={<CollegeTeachers />} />
          <Route path="students" element={<CollegeStudents />} />
          <Route path="attendance" element={<CollegeAttendance />} />
          <Route path="liveness" element={<CollegeLiveness />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
