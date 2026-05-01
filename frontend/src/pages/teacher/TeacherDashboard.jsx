import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Grid, Card, CardContent, Typography, Button, Skeleton } from '@mui/material'
import {
  CameraAlt, Visibility, Assessment, Send, People, TodayOutlined,
  CollectionsBookmark, Timeline
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

const StatCard = ({ title, value, icon, gradient, delay }) => (
  <Grid size={{ xs: 6, sm: 6, md: 3 }}>
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Card sx={{ background: gradient, color: '#fff', position: 'relative', overflow: 'hidden', height: '100%' }}>
        <CardContent sx={{ py: 3, px: 2.5, minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box sx={{ position: 'absolute', right: 12, top: 12, opacity: 0.2 }}>
            {icon}
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5, fontSize: '0.8rem', fontWeight: 500 }}>{title}</Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: '2rem', md: '2.5rem' } }}>{value}</Typography>
        </CardContent>
      </Card>
    </motion.div>
  </Grid>
)

const ActionCard = ({ title, description, icon, color, path, delay }) => {
  const navigate = useNavigate()
  return (
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
        <Card sx={{ height: '100%', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}
          onClick={() => navigate(path)}
        >
          <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              {icon}
            </Box>
            <Typography variant="h6" sx={{ fontSize: '1rem', mb: 1 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{description}</Typography>
            <Button size="small" sx={{ mt: 2, alignSelf: 'flex-start', color }} variant="text">
              Open →
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </Grid>
  )
}

export default function TeacherDashboard() {
  const [stats, setStats] = useState({ today_count: 0, total_students: 0, batch_count: 0, active_sessions: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/teacher/dashboard')
      .then(r => { setStats(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <Box>
      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <StatCard title="Today's Attendance" value={loading ? '...' : stats.today_count}
          icon={<TodayOutlined sx={{ fontSize: 56 }} />}
          gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" delay={0} />
        <StatCard title="Total Students" value={loading ? '...' : stats.total_students}
          icon={<People sx={{ fontSize: 56 }} />}
          gradient="linear-gradient(135deg, #ec4899, #f43f5e)" delay={0.1} />
        <StatCard title="Batches" value={loading ? '...' : stats.batch_count}
          icon={<CollectionsBookmark sx={{ fontSize: 56 }} />}
          gradient="linear-gradient(135deg, #06b6d4, #3b82f6)" delay={0.2} />
        <StatCard title="Active Sessions" value={loading ? '...' : stats.active_sessions}
          icon={<Visibility sx={{ fontSize: 56 }} />}
          gradient="linear-gradient(135deg, #10b981, #14b8a6)" delay={0.3} />
      </Grid>

      {/* Quick Actions */}
      <Typography variant="h6" sx={{ mb: 2, color: '#1e293b' }}>Quick Actions</Typography>
      <Grid container spacing={3}>
        <ActionCard
          title="Mark Attendance"
          description="Capture group photo and mark attendance with time-restricted windows."
          icon={<CameraAlt sx={{ color: '#6366f1' }} />}
          color="#6366f1" path="/teacher/attendance" delay={0.2}
        />
        <ActionCard
          title="Liveness Monitor"
          description="Enable real-time engagement tracking with red/green face annotations."
          icon={<Visibility sx={{ color: '#10b981' }} />}
          color="#10b981" path="/teacher/liveness" delay={0.3}
        />
        <ActionCard
          title="Engagement Reports"
          description="View detailed engagement analytics per class, section, and period."
          icon={<Assessment sx={{ color: '#06b6d4' }} />}
          color="#06b6d4" path="/teacher/engagement" delay={0.4}
        />
        <ActionCard
          title="Send Reports"
          description="Send attendance reports to HODs, Directors, and Parents with automation."
          icon={<Send sx={{ color: '#f59e0b' }} />}
          color="#f59e0b" path="/teacher/reports" delay={0.5}
        />
      </Grid>
    </Box>
  )
}
