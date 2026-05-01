import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert
} from '@mui/material'
import { Add, Delete, Edit, School } from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

export default function CollegeTeachers() {
  const [teachers, setTeachers] = useState([])
  const [dialog, setDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [editForm, setEditForm] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => {
    axios.get('/api/college/teachers').then(r => setTeachers(r.data)).catch(e => setError(e.response?.data?.error || 'Failed to load teachers'))
  }
  useEffect(() => { load() }, [])

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 2000); return () => clearTimeout(t) } }, [success])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 3000); return () => clearTimeout(t) } }, [error])

  const handleAdd = async () => {
    setError('')
    try {
      await axios.post('/api/college/teachers', form)
      setDialog(false); setForm({ name: '', email: '', password: '' })
      setSuccess('Teacher registered!'); load()
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleUpdate = async () => {
    try {
      await axios.put(`/api/college/teachers/${editForm.id}`, editForm)
      setEditDialog(false); setSuccess('Updated!'); load()
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this teacher?')) return
    try {
      await axios.delete(`/api/college/teachers/${id}`)
      setSuccess('Teacher deleted!'); load()
    } catch (e) { setError(e.response?.data?.error || 'Failed to delete') }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Teachers & HODs</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialog(true)}>Register Teacher</Button>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teachers.map((t, i) => (
                <TableRow key={t.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => { setEditForm(t); setEditDialog(true) }}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(t.id)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {teachers.length === 0 && (
                <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>No teachers registered yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Add Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register New Teacher</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}>Register</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Teacher</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Name" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="New Password (leave blank to keep)" type="password" value={editForm.password || ''} onChange={e => setEditForm({ ...editForm, password: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdate}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
