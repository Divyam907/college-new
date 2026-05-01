import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tabs, Tab,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material'
import { Add, Delete, Edit, AccountTree, Business } from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

export default function CollegeStructure() {
  const [tab, setTab] = useState(0)
  const [batches, setBatches] = useState([])
  const [branches, setBranches] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [dialog, setDialog] = useState({ open: false, type: '' })
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters for classes tab
  const [classBatchFilter, setClassBatchFilter] = useState('')
  const [classBranchFilter, setClassBranchFilter] = useState('')
  // Filters for sections tab
  const [secBatchFilter, setSecBatchFilter] = useState('')
  const [secBranchFilter, setSecBranchFilter] = useState('')
  const [secClassFilter, setSecClassFilter] = useState('')

  const load = () => {
    axios.get('/api/college/batches').then(r => setBatches(r.data))
    axios.get('/api/college/branches').then(r => setBranches(r.data))
    axios.get('/api/college/classes').then(r => setClasses(r.data))
    axios.get('/api/college/sections').then(r => setSections(r.data))
  }
  useEffect(() => { load() }, [])

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 2000); return () => clearTimeout(t) } }, [success])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 3000); return () => clearTimeout(t) } }, [error])

  const handleAdd = async () => {
    setError(''); setSuccess('')
    try {
      if (dialog.type === 'batch') {
        await axios.post('/api/college/batches', form)
      } else if (dialog.type === 'branch') {
        await axios.post('/api/college/branches', form)
      } else if (dialog.type === 'class') {
        await axios.post('/api/college/classes', form)
      } else if (dialog.type === 'section') {
        await axios.post('/api/college/sections', form)
      }
      setDialog({ open: false, type: '' }); setForm({})
      setSuccess('Added successfully!')
      load()
    } catch (e) {
      setError(e.response?.data?.error || 'Failed')
    }
  }

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this item? Related items will also be removed.')) return
    try {
      await axios.delete(`/api/college/${type}/${id}`)
      setSuccess('Deleted successfully!')
      load()
    } catch (e) { setError(e.response?.data?.error || 'Failed to delete') }
  }

  // Filtered data
  const filteredClasses = classes.filter(c => {
    if (classBatchFilter && c.batch_id != classBatchFilter) return false
    if (classBranchFilter && c.branch_id != classBranchFilter) return false
    return true
  })

  const filteredSections = sections.filter(s => {
    if (secClassFilter && s.class_id != secClassFilter) return false
    if (secBatchFilter) {
      const cls = classes.find(c => c.id == s.class_id)
      if (!cls || cls.batch_id != secBatchFilter) return false
    }
    if (secBranchFilter) {
      const cls = classes.find(c => c.id == s.class_id)
      if (!cls || cls.branch_id != secBranchFilter) return false
    }
    return true
  })

  const secClassOptions = classes.filter(c => {
    if (secBatchFilter && c.batch_id != secBatchFilter) return false
    if (secBranchFilter && c.branch_id != secBranchFilter) return false
    return true
  })

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Academic Structure</Typography>
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Batches (${batches.length})`} />
        <Tab label={`Branches (${branches.length})`} />
        <Tab label={`Classes (${classes.length})`} />
        <Tab label={`Sections (${sections.length})`} />
      </Tabs>

      {/* Batches */}
      {tab === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => { setDialog({ open: true, type: 'batch' }); setForm({}) }}>
              Add Batch
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Passing Year</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {batches.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell><Chip label={b.year} size="small" color="primary" variant="outlined" /></TableCell>
                    <TableCell>
                      <IconButton color="error" size="small" onClick={() => handleDelete('batches', b.id)}><Delete fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {batches.length === 0 && <TableRow><TableCell colSpan={3} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>No batches yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      )}

      {/* Branches */}
      {tab === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => { setDialog({ open: true, type: 'branch' }); setForm({}) }}>
              Add Branch
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>HOD</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>HOD Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {branches.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell><Chip label={b.code || '-'} size="small" /></TableCell>
                    <TableCell>{b.hod_name || '-'}</TableCell>
                    <TableCell>{b.hod_email || '-'}</TableCell>
                    <TableCell>
                      <IconButton color="error" size="small" onClick={() => handleDelete('branches', b.id)}><Delete fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {branches.length === 0 && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>No branches yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      )}

      {/* Classes */}
      {tab === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, sm: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Batch</InputLabel>
                    <Select value={classBatchFilter} label="Batch" onChange={e => setClassBatchFilter(e.target.value)}>
                      <MenuItem value="">All Batches</MenuItem>
                      {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name} ({b.year})</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Branch</InputLabel>
                    <Select value={classBranchFilter} label="Branch" onChange={e => setClassBranchFilter(e.target.value)}>
                      <MenuItem value="">All Branches</MenuItem>
                      {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="contained" startIcon={<Add />} onClick={() => { setDialog({ open: true, type: 'class' }); setForm({ batch_id: classBatchFilter, branch_id: classBranchFilter }) }}>
                    Add Class
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Batch</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Branch</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Sections</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Students</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {filteredClasses.map(c => (
                  <TableRow key={c.id}>
                    <TableCell sx={{ fontWeight: 500 }}>{c.name}</TableCell>
                    <TableCell>{c.batch_name || '-'}</TableCell>
                    <TableCell>{c.branch_name || '-'}</TableCell>
                    <TableCell><Chip label={c.section_count} size="small" color="info" /></TableCell>
                    <TableCell><Chip label={c.student_count} size="small" color="success" /></TableCell>
                    <TableCell>
                      <IconButton color="error" size="small" onClick={() => handleDelete('classes', c.id)}><Delete fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredClasses.length === 0 && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>No classes found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      )}

      {/* Sections */}
      {tab === 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 6, sm: 2.5 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Batch</InputLabel>
                    <Select value={secBatchFilter} label="Batch" onChange={e => { setSecBatchFilter(e.target.value); setSecClassFilter('') }}>
                      <MenuItem value="">All</MenuItem>
                      {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, sm: 2.5 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Branch</InputLabel>
                    <Select value={secBranchFilter} label="Branch" onChange={e => { setSecBranchFilter(e.target.value); setSecClassFilter('') }}>
                      <MenuItem value="">All</MenuItem>
                      {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Class</InputLabel>
                    <Select value={secClassFilter} label="Class" onChange={e => setSecClassFilter(e.target.value)}>
                      <MenuItem value="">All</MenuItem>
                      {secClassOptions.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="contained" startIcon={<Add />} onClick={() => { setDialog({ open: true, type: 'section' }); setForm({ class_id: secClassFilter }) }}>
                    Add Section
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Students</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {filteredSections.map(s => (
                  <TableRow key={s.id}>
                    <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                    <TableCell>{s.class_name || '-'}</TableCell>
                    <TableCell><Chip label={s.student_count} size="small" color="success" /></TableCell>
                    <TableCell>
                      <IconButton color="error" size="small" onClick={() => handleDelete('sections', s.id)}><Delete fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSections.length === 0 && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>No sections found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      )}

      {/* Add Dialog */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, type: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>Add {dialog.type}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Name" size="small" value={form.name || ''}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            </Grid>
            {dialog.type === 'batch' && (
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Passing Year" size="small" type="number" value={form.year || ''}
                  onChange={e => setForm({ ...form, year: e.target.value })} required />
              </Grid>
            )}
            {dialog.type === 'branch' && (<>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth label="Code (e.g. CSE)" size="small" value={form.code || ''}
                  onChange={e => setForm({ ...form, code: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth label="HOD Name" size="small" value={form.hod_name || ''}
                  onChange={e => setForm({ ...form, hod_name: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="HOD Email" size="small" type="email" value={form.hod_email || ''}
                  onChange={e => setForm({ ...form, hod_email: e.target.value })} />
              </Grid>
            </>)}
            {dialog.type === 'class' && (<>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Batch</InputLabel>
                  <Select value={form.batch_id || ''} label="Batch" onChange={e => setForm({ ...form, batch_id: e.target.value })}>
                    <MenuItem value="">-- Select Batch --</MenuItem>
                    {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name} ({b.year})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Branch</InputLabel>
                  <Select value={form.branch_id || ''} label="Branch" onChange={e => setForm({ ...form, branch_id: e.target.value })}>
                    <MenuItem value="">-- Select Branch --</MenuItem>
                    {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </>)}
            {dialog.type === 'section' && (
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Class</InputLabel>
                  <Select value={form.class_id || ''} label="Class" onChange={e => setForm({ ...form, class_id: e.target.value })} required>
                    <MenuItem value="">-- Select Class --</MenuItem>
                    {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.batch_name ? `(${c.batch_name})` : ''}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialog({ open: false, type: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
