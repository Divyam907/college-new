import { useState, useRef, useCallback } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, FormControl, InputLabel,
  Select, MenuItem, Button, Chip, Alert, Paper, CircularProgress, List,
  ListItem, ListItemIcon, ListItemText, Divider
} from '@mui/material'
import {
  CameraAlt, CheckCircle, AccessTime, Block, PhotoCamera, Videocam
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { getBatches, getBranches, getClasses, getSections, getPeriods, markAttendance } from '../../api'

export default function TeacherAttendance() {
  const [batches, setBatches] = useState([])
  const [branches, setBranches] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [periods, setPeriods] = useState([])

  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Load batches on mount
  useState(() => {
    getBatches().then(r => setBatches(r.data)).catch(() => {})
  })

  const handleBatchChange = async (val) => {
    setSelectedBatch(val)
    setSelectedBranch(''); setSelectedClass(''); setSelectedSection('')
    setPeriods([]); setSelectedPeriod(null)
    if (val) {
      const r = await getBranches(val)
      setBranches(r.data)
    }
  }

  const handleBranchChange = async (val) => {
    setSelectedBranch(val)
    setSelectedClass(''); setSelectedSection('')
    setPeriods([]); setSelectedPeriod(null)
    if (val) {
      const r = await getClasses(val, selectedBatch)
      setClasses(r.data)
    }
  }

  const handleClassChange = async (val) => {
    setSelectedClass(val)
    setSelectedSection('')
    setPeriods([]); setSelectedPeriod(null)
    if (val) {
      const r = await getSections(val)
      setSections(r.data)
    }
  }

  const handleSectionChange = async (val) => {
    setSelectedSection(val)
    setPeriods([]); setSelectedPeriod(null)
    if (val) {
      const r = await getPeriods(val)
      setPeriods(r.data)
    }
  }

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraActive(true)
    } catch (e) {
      setError('Camera access denied: ' + e.message)
    }
  }, [])

  const captureAndMark = async () => {
    if (!selectedSection || !selectedPeriod) {
      setError('Please select all fields and a period')
      return
    }

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const photo = canvas.toDataURL('image/jpeg', 0.85)

    setProcessing(true)
    setError('')
    setResult(null)

    try {
      const res = await markAttendance(photo, selectedSection, selectedPeriod.id)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to mark attendance')
    }
    setProcessing(false)
  }

  return (
    <Box>
      {/* Selection Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt color="primary" /> Select Class Details
          </Typography>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Batch</InputLabel>
                <Select value={selectedBatch} label="Batch" onChange={(e) => handleBatchChange(e.target.value)}>
                  {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name} ({b.year})</MenuItem>)}
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

      {/* Periods */}
      <AnimatePresence>
        {periods.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTime color="primary" /> Today's Periods
                </Typography>
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                  Attendance can only be marked during the time window (10 min before/after start, 5 min before/10 after end)
                </Alert>
                <Grid container spacing={2}>
                  {periods.map(p => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                      <Paper
                        elevation={selectedPeriod?.id === p.id ? 4 : 0}
                        onClick={() => { if (p.can_mark) { setSelectedPeriod(p); startCamera() } }}
                        sx={{
                          p: 2, cursor: p.can_mark ? 'pointer' : 'not-allowed',
                          opacity: p.can_mark ? 1 : 0.5,
                          border: '2px solid',
                          borderColor: selectedPeriod?.id === p.id ? 'primary.main' : p.can_mark ? '#e2e8f0' : '#fecaca',
                          bgcolor: selectedPeriod?.id === p.id ? '#f0f0ff' : p.can_mark ? '#f8fafc' : '#fff5f5',
                          borderLeft: `5px solid ${p.can_mark ? '#10b981' : '#ef4444'}`,
                          transition: 'all 0.2s',
                          '&:hover': p.can_mark ? { borderColor: 'primary.main', transform: 'translateY(-2px)' } : {},
                        }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{p.from_time} - {p.to_time}</Typography>
                        <Chip
                          size="small"
                          icon={p.can_mark ? <CheckCircle /> : <Block />}
                          label={p.window_message}
                          color={p.can_mark ? 'success' : 'default'}
                          sx={{ mt: 1 }}
                        />
                        {p.teacher && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>👤 {p.teacher}</Typography>}
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera */}
      <AnimatePresence>
        {cameraActive && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <Videocam color="error" /> Camera Feed
                </Typography>
                <Box sx={{ borderRadius: 3, overflow: 'hidden', display: 'inline-block', boxShadow: 3, mb: 2 }}>
                  <video ref={videoRef} autoPlay playsInline style={{ maxWidth: '100%', maxHeight: 400, display: 'block' }} />
                </Box>
                <Box>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <PhotoCamera />}
                    onClick={captureAndMark}
                    disabled={processing}
                    sx={{
                      px: 4, py: 1.5,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
                    }}
                  >
                    {processing ? 'Processing...' : 'Capture & Mark Attendance'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                  <strong>Attendance marked successfully!</strong> ({result.window_type} window)
                </Alert>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>{result.total_faces_detected}</Typography>
                      <Typography variant="caption" color="text.secondary">Faces Detected</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f0fdf4' }}>
                      <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>{result.total_matched}</Typography>
                      <Typography variant="caption" color="text.secondary">Matched</Typography>
                    </Paper>
                  </Grid>
                </Grid>
                {result.students_present?.length > 0 && (
                  <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Students Marked Present:</Typography>
                    <List dense>
                      {result.students_present.map(s => (
                        <ListItem key={s.id}>
                          <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                          <ListItemText primary={s.name} secondary={s.email} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
