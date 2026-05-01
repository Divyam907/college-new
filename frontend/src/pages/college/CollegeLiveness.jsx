import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, LinearProgress
} from '@mui/material'
import { Visibility, FiberManualRecord } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import axios from '../../api'

export default function CollegeLiveness() {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    axios.get('/api/college/liveness/sessions').then(r => setSessions(r.data))
  }, [])

  const handleSelectSession = async (s) => {
    setSelectedSession(s)
    const r = await axios.get(`/api/college/liveness/${s.id}/logs`)
    setLogs(r.data)
  }

  const chartData = logs.slice(0, 20).reverse().map(l => ({
    time: l.timestamp.split(' ')[1]?.substring(0, 5) || l.timestamp,
    score: l.avg_score,
    faces: l.total_faces
  }))

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Liveness & Engagement Monitor</Typography>

      {/* Sessions */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Monitoring Sessions</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Section</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Period</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Teacher</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Started</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Interval</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map(s => (
                  <TableRow key={s.id} hover onClick={() => handleSelectSession(s)}
                    sx={{ cursor: 'pointer', bgcolor: selectedSession?.id === s.id ? '#f0f9ff' : 'inherit' }}>
                    <TableCell>
                      <Chip icon={<FiberManualRecord sx={{ fontSize: 10 }} />}
                        label={s.is_active ? 'Active' : 'Ended'}
                        color={s.is_active ? 'success' : 'default'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{s.class_name}</TableCell>
                    <TableCell>{s.section_name}</TableCell>
                    <TableCell>{s.period}</TableCell>
                    <TableCell>{s.teacher || '-'}</TableCell>
                    <TableCell>{s.started_at?.substring(0, 16)}</TableCell>
                    <TableCell>{s.interval}s</TableCell>
                  </TableRow>
                ))}
                {sessions.length === 0 && (
                  <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>
                    No monitoring sessions found. Teachers can start sessions from their portal.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Logs for selected session */}
      {selectedSession && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Logs: {selectedSession.class_name} - {selectedSession.section_name} ({selectedSession.period})
          </Typography>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Engagement Score Over Time</Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Engagement %" />
                    <Line type="monotone" dataKey="faces" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Faces" yAxisId={0} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Log Table */}
          <Card>
            <CardContent sx={{ p: 2 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Faces</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Attentive %</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Distracted %</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.timestamp?.substring(11, 19)}</TableCell>
                        <TableCell>{l.total_faces}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress variant="determinate" value={l.attentive_pct}
                              sx={{ width: 60, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />
                            <Typography variant="body2">{Math.round(l.attentive_pct)}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress variant="determinate" value={l.distracted_pct}
                              sx={{ width: 60, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: '#ef4444' } }} />
                            <Typography variant="body2">{Math.round(l.distracted_pct)}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={`${Math.round(l.avg_score)}%`} size="small"
                            color={l.avg_score > 70 ? 'success' : l.avg_score > 40 ? 'warning' : 'error'} />
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
