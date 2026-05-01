import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, FormControl, InputLabel,
  Select, MenuItem, Button, Chip, Alert, Paper, Switch, FormControlLabel,
  TextField, Checkbox, FormGroup, IconButton, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material'
import {
  Send, Schedule, Delete, Add, CheckCircle, People, SupervisorAccount,
  FamilyRestroom
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { getBatches, getBranches, getClasses, getSections, sendReport, scheduleReport, deleteSchedule, toggleSchedule } from '../../api'
import axios from '../../api'

export default function TeacherReports() {
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
  const [sendToAuthorities, setSendToAuthorities] = useState(true)
  const [sendToParents, setSendToParents] = useState(false)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Schedules
  const [schedules, setSchedules] = useState([])
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [newSchedule, setNewSchedule] = useState({ frequency: 'daily', time: '09:00', include_parents: false })

  useEffect(() => {
    getBatches().then(r => setBatches(r.data)).catch(() => {})
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    try {
      const r = await axios.get('/api/teacher/report-schedules')
      setSchedules(r.data)
    } catch { /* ok */ }
  }

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
  const handleSectionChange = (val) => setSelectedSection(val)

  const handleSendReport = async () => {
    if (!selectedSection || !dateFrom || !dateTo) {
      setError('Please select section and date range')
      return
    }
    setSending(true); setError(''); setSuccess('')
    try {
      const r = await sendReport(selectedSection, dateFrom, dateTo, sendToAuthorities, sendToParents)
      setSuccess(r.data.message || 'Report sent successfully!')
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send report')
    }
    setSending(false)
  }

  const handleCreateSchedule = async () => {
    if (!selectedSection) { setError('Select a section first'); return }
    try {
      await scheduleReport(selectedSection, newSchedule.frequency, newSchedule.time, newSchedule.include_parents)
      setScheduleDialogOpen(false)
      fetchSchedules()
      setSuccess('Schedule created!')
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create schedule')
    }
  }

  const handleDeleteSchedule = async (id) => {
    try {
      await deleteSchedule(id)
      fetchSchedules()
    } catch { /* ignore */ }
  }

  const handleToggleSchedule = async (id) => {
    try {
      await toggleSchedule(id)
      fetchSchedules()
    } catch { /* ignore */ }
  }

  return (
    <Box>
      {/* Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Send color="primary" /> Send Reports
          </Typography>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Batch</InputLabel>
                <Select value={selectedBatch} label="Batch" onChange={(e) => handleBatchChange(e.target.value)}>
                  {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth disabled={!selectedBatch}>
                <InputLabel>Branch</InputLabel>
                <Select value={selectedBranch} label="Branch" onChange={(e) => handleBranchChange(e.target.value)}>
                  {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth disabled={!selectedBranch}>
                <InputLabel>Class</InputLabel>
                <Select value={selectedClass} label="Class" onChange={(e) => handleClassChange(e.target.value)}>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth disabled={!selectedClass}>
                <InputLabel>Section</InputLabel>
                <Select value={selectedSection} label="Section" onChange={(e) => handleSectionChange(e.target.value)}>
                  {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Report Config */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Report Configuration</Typography>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="date" label="From Date"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="date" label="To Date"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1, color: '#64748b' }}>Send To:</Typography>
              <FormGroup row>
                <FormControlLabel
                  control={<Checkbox checked={sendToAuthorities} onChange={(e) => setSendToAuthorities(e.target.checked)} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SupervisorAccount fontSize="small" /> Authorities (HOD / Director)
                  </Box>}
                />
                <FormControlLabel
                  control={<Checkbox checked={sendToParents} onChange={(e) => setSendToParents(e.target.checked)} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FamilyRestroom fontSize="small" /> Parents
                  </Box>}
                />
              </FormGroup>

              <Button
                variant="contained"
                size="large"
                startIcon={<Send />}
                onClick={handleSendReport}
                disabled={sending}
                sx={{ mt: 3, px: 4, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {sending ? 'Sending...' : 'Send Report Now'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Info */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Report Contents</Typography>
              <List dense>
                {['Period-wise attendance', 'P/A matrix per student', 'Date range summary', 'Engagement metrics (if available)', 'Absent streak alerts'].map((item, i) => (
                  <ListItem key={i} disableGutters>
                    <CheckCircle sx={{ color: '#10b981', fontSize: 18, mr: 1 }} />
                    <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Automated Schedules */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="primary" /> Automated Report Schedules
            </Typography>
            <Button variant="outlined" startIcon={<Add />} onClick={() => setScheduleDialogOpen(true)}>
              New Schedule
            </Button>
          </Box>

          {schedules.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
              <Schedule sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No automated schedules yet. Create one to send reports automatically.</Typography>
            </Paper>
          ) : (
            <List>
              {schedules.map((sch) => (
                <motion.div key={sch.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ListItem
                    sx={{ borderRadius: 2, mb: 1, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontWeight: 600 }}>{sch.section_name}</Typography>
                          <Chip size="small" label={sch.frequency} color="primary" variant="outlined" />
                          <Chip size="small" label={sch.time} />
                          {sch.include_parents && <Chip size="small" icon={<FamilyRestroom />} label="Parents" color="secondary" variant="outlined" />}
                        </Box>
                      }
                      secondary={`Created: ${sch.created_at || 'N/A'}`}
                    />
                    <ListItemSecondaryAction>
                      <Switch checked={sch.active} onChange={() => handleToggleSchedule(sch.id)} />
                      <IconButton edge="end" onClick={() => handleDeleteSchedule(sch.id)} color="error">
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </motion.div>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Automated Schedule</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select value={newSchedule.frequency} label="Frequency"
                  onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value })}>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="time" label="Send Time"
                slotProps={{ inputLabel: { shrink: true } }}
                value={newSchedule.time} onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Checkbox checked={newSchedule.include_parents}
                  onChange={(e) => setNewSchedule({ ...newSchedule, include_parents: e.target.checked })} />}
                label="Also send to parents"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSchedule}
            sx={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            Create Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
