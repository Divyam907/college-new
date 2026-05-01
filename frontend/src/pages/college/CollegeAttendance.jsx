import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button, FormControl,
  InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Alert
} from '@mui/material'
import { Download, Search } from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

export default function CollegeAttendance() {
  const [batches, setBatches] = useState([])
  const [branches, setBranches] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [records, setRecords] = useState([])

  const [filters, setFilters] = useState({
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    batch_id: '', branch_id: '', class_id: '', section_id: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    axios.get('/api/college/batches').then(r => setBatches(r.data))
    axios.get('/api/college/branches').then(r => setBranches(r.data))
    axios.get('/api/college/classes').then(r => setClasses(r.data))
  }, [])

  const handleClassChange = async (val) => {
    setFilters({ ...filters, class_id: val, section_id: '' })
    if (val) {
      const r = await axios.get(`/api/college/sections?class_id=${val}`)
      setSections(r.data)
    }
  }

  const handleSearch = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v) })
    const r = await axios.get(`/api/college/attendance?${params}`)
    setRecords(r.data)
    setLoading(false)
  }

  const handleDownload = () => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v) })
    window.open(`/api/college/attendance/download?${params}`, '_blank')
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Attendance Records</Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField fullWidth size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
                value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField fullWidth size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
                value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Batch</InputLabel>
                <Select value={filters.batch_id} label="Batch" onChange={e => setFilters({ ...filters, batch_id: e.target.value })}>
                  <MenuItem value="">All</MenuItem>
                  {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Class</InputLabel>
                <Select value={filters.class_id} label="Class" onChange={e => handleClassChange(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small" disabled={!filters.class_id}>
                <InputLabel>Section</InputLabel>
                <Select value={filters.section_id} label="Section" onChange={e => setFilters({ ...filters, section_id: e.target.value })}>
                  <MenuItem value="">All</MenuItem>
                  {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }} sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" startIcon={<Search />} onClick={handleSearch} disabled={loading}>Search</Button>
              <Button variant="outlined" startIcon={<Download />} onClick={handleDownload} color="success">Excel</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Results</Typography>
              <Chip label={`${records.length} records`} size="small" color="primary" variant="outlined" />
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Roll No</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Section</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Period</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((r, i) => (
                    <TableRow key={i} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                      <TableCell>{r.roll_no || '-'}</TableCell>
                      <TableCell>{r.class_name || '-'}</TableCell>
                      <TableCell>{r.section_name || '-'}</TableCell>
                      <TableCell>{r.period || '-'}</TableCell>
                      <TableCell>{r.time || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {records.length === 0 && (
                    <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>
                      Click "Search" to load attendance records.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  )
}
