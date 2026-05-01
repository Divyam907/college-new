import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, FormControl, InputLabel,
  Select, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, LinearProgress, Chip, TextField
} from '@mui/material'
import { Assessment, TrendingUp, TrendingDown } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { getBatches, getBranches, getClasses, getSections } from '../../api'
import axios from '../../api'

export default function TeacherEngagement() {
  const [batches, setBatches] = useState([])
  const [branches, setBranches] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])

  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [engagementData, setEngagementData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getBatches().then(r => setBatches(r.data)).catch(() => {})
  }, [])

  const handleBatchChange = async (val) => {
    setSelectedBatch(val); setSelectedBranch(''); setSelectedClass(''); setSelectedSection('')
    if (val) { const r = await getBranches(val); setBranches(r.data) }
  }
  const handleBranchChange = async (val) => {
    setSelectedBranch(val); setSelectedClass(''); setSelectedSection('')
    if (val) { const r = await getClasses(val, selectedBatch); setClasses(r.data) }
  }
  const handleClassChange = async (val) => {
    setSelectedClass(val); setSelectedSection('')
    if (val) { const r = await getSections(val); setSections(r.data) }
  }

  const handleSectionChange = async (val) => {
    setSelectedSection(val)
    if (val) fetchEngagementData(val)
  }

  const fetchEngagementData = async (sectionId) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)
      const r = await axios.get(`/api/teacher/engagement/${sectionId}?${params.toString()}`)
      setEngagementData(r.data)
    } catch {
      setEngagementData([])
    }
    setLoading(false)
  }

  const avgScore = engagementData.length > 0
    ? Math.round(engagementData.reduce((sum, d) => sum + (d.score || 0), 0) / engagementData.length)
    : 0

  const chartData = engagementData.slice(-14).map(d => ({
    date: d.date,
    score: d.score,
    engaged: d.engaged,
    disengaged: d.disengaged,
  }))

  return (
    <Box>
      {/* Selection + Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" /> Engagement Analytics
          </Typography>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Batch</InputLabel>
                <Select value={selectedBatch} label="Batch" onChange={(e) => handleBatchChange(e.target.value)}>
                  {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <FormControl fullWidth disabled={!selectedBatch}>
                <InputLabel>Branch</InputLabel>
                <Select value={selectedBranch} label="Branch" onChange={(e) => handleBranchChange(e.target.value)}>
                  {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <FormControl fullWidth disabled={!selectedBranch}>
                <InputLabel>Class</InputLabel>
                <Select value={selectedClass} label="Class" onChange={(e) => handleClassChange(e.target.value)}>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <FormControl fullWidth disabled={!selectedClass}>
                <InputLabel>Section</InputLabel>
                <Select value={selectedSection} label="Section" onChange={(e) => handleSectionChange(e.target.value)}>
                  {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField fullWidth type="date" label="From"
                slotProps={{ inputLabel: { shrink: true } }}
                value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField fullWidth type="date" label="To"
                slotProps={{ inputLabel: { shrink: true } }}
                value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}

      {/* Summary Cards */}
      {engagementData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, textAlign: 'center', borderLeft: '4px solid #6366f1' }}>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#6366f1' }}>{avgScore}%</Typography>
                <Typography variant="body2" color="text.secondary">Average Engagement Score</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, textAlign: 'center', borderLeft: '4px solid #10b981' }}>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#10b981' }}>{engagementData.length}</Typography>
                <Typography variant="body2" color="text.secondary">Sessions Recorded</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  {avgScore >= 60 ? <TrendingUp sx={{ color: '#10b981', fontSize: 32 }} /> : <TrendingDown sx={{ color: '#ef4444', fontSize: 32 }} />}
                  <Typography variant="h3" sx={{ fontWeight: 700, color: avgScore >= 60 ? '#10b981' : '#ef4444' }}>
                    {avgScore >= 60 ? 'Good' : 'Low'}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">Engagement Status</Typography>
              </Paper>
            </Grid>
          </Grid>
        </motion.div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Engagement Trend</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} name="Score (%)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Table */}
      {engagementData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Session Details</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Period</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Engaged</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Disengaged</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {engagementData.map((row, i) => (
                      <TableRow key={i} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.period || '-'}</TableCell>
                        <TableCell>
                          <Typography color="success.main" sx={{ fontWeight: 600 }}>{row.engaged || 0}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography color="error.main" sx={{ fontWeight: 600 }}>{row.disengaged || 0}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={row.score || 0}
                              sx={{
                                width: 60, height: 6, borderRadius: 3, bgcolor: '#e2e8f0',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 3,
                                  bgcolor: (row.score || 0) > 70 ? '#10b981' : (row.score || 0) > 40 ? '#f59e0b' : '#ef4444',
                                },
                              }}
                            />
                            <Typography variant="body2">{row.score || 0}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={(row.score || 0) > 70 ? 'Good' : (row.score || 0) > 40 ? 'Fair' : 'Low'}
                            color={(row.score || 0) > 70 ? 'success' : (row.score || 0) > 40 ? 'warning' : 'error'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </Box>
  )
}
