import { useState, useEffect } from 'react'
import { Box, Grid, Card, CardContent, Typography } from '@mui/material'
import { People, School, CalendarMonth, Business, Visibility, Download, AccountTree, PersonAdd } from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

const StatCard = ({ title, value, icon, color, delay }) => (
  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Card sx={{ borderLeft: `4px solid ${color}` }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color }}>{value}</Typography>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  </Grid>
)

export default function CollegeDashboard() {
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/college/dashboard').then(r => { setStats(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const s = stats
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Dashboard</Typography>
      <Grid container spacing={3}>
        <StatCard title="Today's Attendance" value={s.today_count || 0} icon={<Download sx={{ color: '#6366f1' }} />} color="#6366f1" delay={0} />
        <StatCard title="Students" value={s.total_students || 0} icon={<People sx={{ color: '#10b981' }} />} color="#10b981" delay={0.05} />
        <StatCard title="Classes" value={s.class_count || 0} icon={<School sx={{ color: '#f59e0b' }} />} color="#f59e0b" delay={0.1} />
        <StatCard title="Teachers" value={s.teacher_count || 0} icon={<PersonAdd sx={{ color: '#ec4899' }} />} color="#ec4899" delay={0.15} />
        <StatCard title="Batches" value={s.batch_count || 0} icon={<AccountTree sx={{ color: '#06b6d4' }} />} color="#06b6d4" delay={0.2} />
        <StatCard title="Branches" value={s.branch_count || 0} icon={<Business sx={{ color: '#8b5cf6' }} />} color="#8b5cf6" delay={0.25} />
        <StatCard title="Sections" value={s.section_count || 0} icon={<CalendarMonth sx={{ color: '#14b8a6' }} />} color="#14b8a6" delay={0.3} />
        <StatCard title="Active Sessions" value={s.active_sessions || 0} icon={<Visibility sx={{ color: '#ef4444' }} />} color="#ef4444" delay={0.35} />
      </Grid>
    </Box>
  )
}
