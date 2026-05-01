import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button, FormControl,
  InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Chip, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material'
import { Add, Delete, Edit, CalendarMonth, AutoFixHigh, Save, Close } from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function CollegeTimetable() {
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [timetable, setTimetable] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Add period dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ day: 0, period_name: '', teacher_name: '', from_time: '', to_time: '', is_recess: false })

  // Generate dialog
  const [genOpen, setGenOpen] = useState(false)
  const [genForm, setGenForm] = useState({ start_time: '09:00', end_time: '16:00', num_periods: 6, recess_after: 3, recess_duration: 30, days: [0, 1, 2, 3, 4, 5] })

  // Inline editing
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  useEffect(() => {
    axios.get('/api/college/classes').then(r => setClasses(r.data))
  }, [])

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 2000); return () => clearTimeout(t) } }, [success])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 3000); return () => clearTimeout(t) } }, [error])

  const handleClassChange = async (val) => {
    setSelectedClass(val); setSelectedSection(''); setTimetable([])
    const r = await axios.get(`/api/college/sections?class_id=${val}`)
    setSections(r.data)
  }

  const handleSectionChange = async (val) => {
    setSelectedSection(val)
    if (val) {
      const r = await axios.get(`/api/college/timetable/${val}`)
      setTimetable(r.data)
    }
  }

  const handleAddPeriod = async () => {
    try {
      await axios.post(`/api/college/timetable/${selectedSection}`, addForm)
      setAddOpen(false); setSuccess('Period added!')
      setAddForm({ day: 0, period_name: '', teacher_name: '', from_time: '', to_time: '', is_recess: false })
      handleSectionChange(selectedSection)
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleGenerate = async () => {
    try {
      await axios.post(`/api/college/timetable/${selectedSection}/generate`, genForm)
      setGenOpen(false); setSuccess('Timetable generated!')
      handleSectionChange(selectedSection)
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleInlineSave = async (id) => {
    try {
      await axios.put(`/api/college/timetable/entry/${id}`, editData)
      setEditingId(null); setSuccess('Updated!')
      handleSectionChange(selectedSection)
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this period?')) return
    try {
      await axios.delete(`/api/college/timetable/entry/${id}`)
      setSuccess('Deleted!')
      handleSectionChange(selectedSection)
    } catch (e) { setError(e.response?.data?.error || 'Failed to delete') }
  }

  // Group timetable by day and sort by time
  const grouped = {}
  timetable.forEach(t => {
    if (!grouped[t.day]) grouped[t.day] = []
    grouped[t.day].push(t)
  })
  Object.values(grouped).forEach(arr => arr.sort((a, b) => (a.from_time || '').localeCompare(b.from_time || '')))

  // Get unique time slots for grid header
  const timeSlots = [...new Set(timetable.map(t => `${t.from_time}-${t.to_time}`))].sort()

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Timetable Management</Typography>
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Class</InputLabel>
                <Select value={selectedClass} label="Class" onChange={e => handleClassChange(e.target.value)}>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.branch_name ? `(${c.branch_name})` : ''}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth size="small" disabled={!selectedClass}>
                <InputLabel>Section</InputLabel>
                <Select value={selectedSection} label="Section" onChange={e => handleSectionChange(e.target.value)}>
                  {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {selectedSection && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>Add Period</Button>
                  <Button variant="outlined" startIcon={<AutoFixHigh />} onClick={() => setGenOpen(true)} color="secondary">Auto Generate</Button>
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Timetable Grid View */}
      {selectedSection && timetable.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <TableContainer component={Paper} sx={{ overflow: 'auto' }}>
            <Table size="small" sx={{ minWidth: 800, borderCollapse: 'collapse' }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#1e293b' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#fff', border: '1px solid #334155', minWidth: 80 }}>DAY</TableCell>
                  {timeSlots.map((slot, i) => (
                    <TableCell key={i} sx={{ fontWeight: 600, color: '#fff', border: '1px solid #334155', textAlign: 'center', minWidth: 120, fontSize: '0.75rem' }}>
                      {slot}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {DAYS.map((dayName, dayIdx) => {
                  const dayPeriods = grouped[dayIdx] || []
                  return (
                    <TableRow key={dayIdx} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                        {DAY_SHORT[dayIdx]}
                      </TableCell>
                      {timeSlots.map((slot, slotIdx) => {
                        const period = dayPeriods.find(p => `${p.from_time}-${p.to_time}` === slot)
                        if (!period) {
                          return <TableCell key={slotIdx} sx={{ border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8' }}>-</TableCell>
                        }
                        const isEditing = editingId === period.id
                        return (
                          <TableCell key={slotIdx} sx={{
                            border: '1px solid #e2e8f0', textAlign: 'center', p: 0.5,
                            bgcolor: period.is_recess ? '#fef3c7' : 'inherit',
                            position: 'relative',
                            '&:hover .cell-actions': { opacity: 1 }
                          }}>
                            {isEditing ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.5 }}>
                                <TextField size="small" variant="standard" placeholder="Subject"
                                  value={editData.period_name || ''} onChange={e => setEditData({ ...editData, period_name: e.target.value })}
                                  sx={{ '& input': { fontSize: '0.75rem', textAlign: 'center' } }} />
                                <TextField size="small" variant="standard" placeholder="Teacher"
                                  value={editData.teacher_name || ''} onChange={e => setEditData({ ...editData, teacher_name: e.target.value })}
                                  sx={{ '& input': { fontSize: '0.7rem', textAlign: 'center' } }} />
                                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                  <IconButton size="small" color="primary" onClick={() => handleInlineSave(period.id)}><Save sx={{ fontSize: 14 }} /></IconButton>
                                  <IconButton size="small" onClick={() => setEditingId(null)}><Close sx={{ fontSize: 14 }} /></IconButton>
                                </Box>
                              </Box>
                            ) : (
                              <Box sx={{ cursor: 'pointer', py: 0.5 }} onClick={() => { setEditingId(period.id); setEditData(period) }}>
                                <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: period.is_recess ? '#92400e' : '#1e293b' }}>
                                  {period.period_name || '-'}
                                </Typography>
                                {!period.is_recess && (
                                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                                    {period.teacher_name || ''}
                                  </Typography>
                                )}
                                <Box className="cell-actions" sx={{ position: 'absolute', top: 2, right: 2, opacity: 0, transition: 'opacity 0.2s' }}>
                                  <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(period.id) }}>
                                    <Delete sx={{ fontSize: 12 }} />
                                  </IconButton>
                                </Box>
                              </Box>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#64748b' }}>
            Click any cell to edit. Hover to see delete button.
          </Typography>
        </motion.div>
      )}

      {selectedSection && timetable.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
          <CalendarMonth sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
          <Typography color="text.secondary">No timetable entries yet. Add periods or use Auto Generate.</Typography>
        </Paper>
      )}

      {/* Add Period Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Period</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Day</InputLabel>
                <Select value={addForm.day} label="Day" onChange={e => setAddForm({ ...addForm, day: parseInt(e.target.value) })}>
                  {DAYS.map((d, i) => <MenuItem key={i} value={i}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="Subject / Period Name" value={addForm.period_name}
                onChange={e => setAddForm({ ...addForm, period_name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="From" type="time" slotProps={{ inputLabel: { shrink: true } }}
                value={addForm.from_time} onChange={e => setAddForm({ ...addForm, from_time: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="To" type="time" slotProps={{ inputLabel: { shrink: true } }}
                value={addForm.to_time} onChange={e => setAddForm({ ...addForm, to_time: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" label="Teacher Name" value={addForm.teacher_name}
                onChange={e => setAddForm({ ...addForm, teacher_name: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddPeriod}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={genOpen} onClose={() => setGenOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Auto-Generate Timetable</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>This will replace all existing entries for this section.</Alert>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="Start Time" type="time" slotProps={{ inputLabel: { shrink: true } }}
                value={genForm.start_time} onChange={e => setGenForm({ ...genForm, start_time: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="End Time" type="time" slotProps={{ inputLabel: { shrink: true } }}
                value={genForm.end_time} onChange={e => setGenForm({ ...genForm, end_time: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth size="small" label="No. of Periods" type="number"
                value={genForm.num_periods} onChange={e => setGenForm({ ...genForm, num_periods: parseInt(e.target.value) })} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth size="small" label="Recess After" type="number"
                value={genForm.recess_after} onChange={e => setGenForm({ ...genForm, recess_after: parseInt(e.target.value) })} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth size="small" label="Recess (min)" type="number"
                value={genForm.recess_duration} onChange={e => setGenForm({ ...genForm, recess_duration: parseInt(e.target.value) })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenOpen(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={handleGenerate}>Generate</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
