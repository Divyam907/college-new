import { useState, useEffect, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert, FormControl,
  InputLabel, Select, MenuItem, Tabs, Tab
} from '@mui/material'
import { Add, Delete, Edit, Upload, People, PersonAdd } from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

export default function CollegeStudents() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(false)
  const [bulkDialog, setBulkDialog] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', roll_no: '', class_id: '', section_id: '', dob: '' })
  const [editForm, setEditForm] = useState({})
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkClassId, setBulkClassId] = useState('')
  const [bulkSectionId, setBulkSectionId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogSections, setDialogSections] = useState([])
  const fileRef = useRef()

  const loadStudents = () => {
    let url = '/api/college/students?'
    if (filterClass) url += `class_id=${filterClass}&`
    if (filterSection) url += `section_id=${filterSection}&`
    axios.get(url).then(r => setStudents(r.data))
  }

  useEffect(() => {
    axios.get('/api/college/classes').then(r => setClasses(r.data))
    loadStudents()
  }, [])

  useEffect(loadStudents, [filterClass, filterSection])

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 2000); return () => clearTimeout(t) } }, [success])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 3000); return () => clearTimeout(t) } }, [error])

  const handleClassFilter = async (val) => {
    setFilterClass(val); setFilterSection('')
    if (val) {
      const r = await axios.get(`/api/college/sections?class_id=${val}`)
      setSections(r.data)
    } else { setSections([]) }
  }

  const handleAdd = async () => {
    setError('')
    try {
      await axios.post('/api/college/students', form)
      setDialog(false); setForm({ name: '', email: '', roll_no: '', class_id: '', section_id: '', dob: '' })
      setSuccess('Student registered!'); loadStudents()
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleUpdate = async () => {
    try {
      await axios.put(`/api/college/students/${editForm.id}`, editForm)
      setEditDialog(false); setSuccess('Updated!'); loadStudents()
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student and all their data?')) return
    try {
      await axios.delete(`/api/college/students/${id}`)
      setSuccess('Student deleted!'); loadStudents()
    } catch (e) { setError(e.response?.data?.error || 'Failed to delete') }
  }

  const handleFormClassChange = async (val) => {
    setForm({ ...form, class_id: val, section_id: '' })
    if (val) {
      const r = await axios.get(`/api/college/sections?class_id=${val}`)
      setDialogSections(r.data)
    } else { setDialogSections([]) }
  }

  const handleEditClassChange = async (val) => {
    setEditForm({ ...editForm, class_id: val, section_id: '' })
    if (val) {
      const r = await axios.get(`/api/college/sections?class_id=${val}`)
      setDialogSections(r.data)
    } else { setDialogSections([]) }
  }

  const handleBulkUpload = async () => {
    if (!bulkFile) { setError('Select a file'); return }
    const fd = new FormData()
    fd.append('file', bulkFile)
    if (bulkClassId) fd.append('class_id', bulkClassId)
    if (bulkSectionId) fd.append('section_id', bulkSectionId)
    try {
      const r = await axios.post('/api/college/students/bulk', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setBulkDialog(false); setBulkFile(null)
      setSuccess(`${r.data.added} students added!${r.data.errors?.length ? ` ${r.data.errors.length} errors.` : ''}`)
      loadStudents()
    } catch (e) { setError(e.response?.data?.error || 'Upload failed') }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Students</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Upload />} onClick={() => setBulkDialog(true)}>Bulk Upload</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialog(true)}>Add Student</Button>
        </Box>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Class</InputLabel>
                <Select value={filterClass} label="Filter by Class" onChange={e => handleClassFilter(e.target.value)}>
                  <MenuItem value="">All Classes</MenuItem>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small" disabled={!filterClass}>
                <InputLabel>Filter by Section</InputLabel>
                <Select value={filterSection} label="Filter by Section" onChange={e => setFilterSection(e.target.value)}>
                  <MenuItem value="">All Sections</MenuItem>
                  {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip label={`${students.length} students`} color="primary" variant="outlined" />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Roll No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Section</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>DOB</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s, i) => (
                <TableRow key={s.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                  <TableCell>{s.roll_no || '-'}</TableCell>
                  <TableCell>{s.email || '-'}</TableCell>
                  <TableCell>{s.class_name || '-'}</TableCell>
                  <TableCell>{s.section_name || '-'}</TableCell>
                  <TableCell>{s.dob || '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => { setEditForm(s); setEditDialog(true) }}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && (
                <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>No students found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Add Student Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register Student</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Grid>
            <Grid size={{ xs: 6 }}><TextField fullWidth label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Grid>
            <Grid size={{ xs: 6 }}><TextField fullWidth label="Roll No" value={form.roll_no} onChange={e => setForm({ ...form, roll_no: e.target.value })} /></Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Class</InputLabel>
                <Select value={form.class_id} label="Class" onChange={e => handleFormClassChange(e.target.value)}>
                  <MenuItem value="">--</MenuItem>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth disabled={!form.class_id}>
                <InputLabel>Section</InputLabel>
                <Select value={form.section_id} label="Section" onChange={e => setForm({ ...form, section_id: e.target.value })}>
                  <MenuItem value="">--</MenuItem>
                  {dialogSections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Date of Birth" type="date" slotProps={{ inputLabel: { shrink: true } }} value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}>Register</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Student</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Name" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></Grid>
            <Grid size={{ xs: 6 }}><TextField fullWidth label="Email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></Grid>
            <Grid size={{ xs: 6 }}><TextField fullWidth label="Roll No" value={editForm.roll_no || ''} onChange={e => setEditForm({ ...editForm, roll_no: e.target.value })} /></Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Class</InputLabel>
                <Select value={editForm.class_id || ''} label="Class" onChange={e => handleEditClassChange(e.target.value)}>
                  <MenuItem value="">--</MenuItem>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth disabled={!editForm.class_id}>
                <InputLabel>Section</InputLabel>
                <Select value={editForm.section_id || ''} label="Section" onChange={e => setEditForm({ ...editForm, section_id: e.target.value })}>
                  <MenuItem value="">--</MenuItem>
                  {dialogSections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="DOB" type="date" slotProps={{ inputLabel: { shrink: true } }} value={editForm.dob || ''} onChange={e => setEditForm({ ...editForm, dob: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdate}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkDialog} onClose={() => setBulkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Student Registration</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upload a CSV or Excel file with columns: <strong>name</strong> (required), email, roll_no, dob
          </Alert>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}>
              <Button variant="outlined" component="label" fullWidth>
                {bulkFile ? bulkFile.name : 'Choose CSV/Excel File'}
                <input type="file" hidden accept=".csv,.xlsx,.xls" onChange={e => setBulkFile(e.target.files[0])} />
              </Button>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth label="Default Class" size="small" select SelectProps={{ native: true }}
                value={bulkClassId} onChange={e => setBulkClassId(e.target.value)}>
                <option value="">--</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth label="Default Section" size="small" select SelectProps={{ native: true }}
                value={bulkSectionId} onChange={e => setBulkSectionId(e.target.value)}>
                <option value="">--</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBulkDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkUpload} startIcon={<Upload />}>Upload & Register</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
