import { useState, useEffect, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, FormControl, InputLabel,
  Select, MenuItem, Button, Chip, Alert, Paper, Switch, FormControlLabel,
  LinearProgress
} from '@mui/material'
import {
  Visibility, VisibilityOff, FiberManualRecord, Refresh, Person, SentimentSatisfied,
  SentimentVeryDissatisfied, Thermostat
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { getBatches, getBranches, getClasses, getSections, getCameraStatus, enableLiveness, disableLiveness, captureLiveness } from '../../api'

export default function TeacherLiveness() {
  const [batches, setBatches] = useState([])
  const [branches, setBranches] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])

  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')

  const [monitoring, setMonitoring] = useState(false)
  const [cameraStatus, setCameraStatus] = useState(null)
  const [captureResult, setCaptureResult] = useState(null)
  const [annotatedImage, setAnnotatedImage] = useState(null)
  const [autoCapture, setAutoCapture] = useState(false)
  const [error, setError] = useState('')

  const intervalRef = useRef(null)

  useEffect(() => {
    getBatches().then(r => setBatches(r.data)).catch(() => {})
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
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
    if (val) {
      const r = await getCameraStatus(val)
      setCameraStatus(r.data)
    }
  }

  const handleEnableMonitoring = async () => {
    try {
      await enableLiveness(selectedSection)
      setMonitoring(true)
      setCameraStatus(prev => ({ ...prev, active: true }))
      setError('')
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to enable monitoring')
    }
  }

  const handleDisableMonitoring = async () => {
    try {
      await disableLiveness(selectedSection)
      setMonitoring(false)
      setCameraStatus(prev => ({ ...prev, active: false }))
      setAutoCapture(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to disable')
    }
  }

  const handleCapture = async () => {
    try {
      const r = await captureLiveness(selectedSection)
      setCaptureResult(r.data)
      if (r.data.annotated_image) setAnnotatedImage(r.data.annotated_image)
    } catch (e) {
      setError(e.response?.data?.error || 'Capture failed')
    }
  }

  const toggleAutoCapture = (enabled) => {
    setAutoCapture(enabled)
    if (enabled) {
      intervalRef.current = setInterval(handleCapture, 5000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  return (
    <Box>
      {/* Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Visibility color="primary" /> Liveness Monitoring Setup
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

      {/* Camera Status */}
      <AnimatePresence>
        {cameraStatus && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FiberManualRecord sx={{ color: monitoring ? '#10b981' : '#94a3b8', fontSize: 14 }} />
                    <Typography variant="h6">Camera Status</Typography>
                    <Chip label={monitoring ? 'Active' : 'Inactive'} color={monitoring ? 'success' : 'default'} size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControlLabel
                      control={<Switch checked={autoCapture} onChange={(e) => toggleAutoCapture(e.target.checked)} disabled={!monitoring} />}
                      label="Auto Capture (5s)"
                    />
                    {!monitoring ? (
                      <Button variant="contained" startIcon={<Visibility />} onClick={handleEnableMonitoring}
                        sx={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}>
                        Enable Monitoring
                      </Button>
                    ) : (
                      <Button variant="outlined" color="error" startIcon={<VisibilityOff />} onClick={handleDisableMonitoring}>
                        Disable
                      </Button>
                    )}
                  </Box>
                </Box>

                {monitoring && (
                  <Box sx={{ mt: 2 }}>
                    <Button variant="outlined" startIcon={<Refresh />} onClick={handleCapture} sx={{ mr: 2 }}>
                      Capture Now
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Annotated Image */}
      <AnimatePresence>
        {annotatedImage && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Live Annotated Feed</Typography>
                <Box sx={{ borderRadius: 3, overflow: 'hidden', display: 'inline-block', boxShadow: 3 }}>
                  <img src={annotatedImage} alt="Annotated" style={{ maxWidth: '100%', maxHeight: 450, display: 'block' }} />
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture Stats */}
      <AnimatePresence>
        {captureResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Engagement Snapshot</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f0fdf4' }}>
                      <Person sx={{ color: '#10b981', fontSize: 32, mb: 0.5 }} />
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#10b981' }}>{captureResult.engaged || 0}</Typography>
                      <Typography variant="caption" color="text.secondary">Engaged</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fef2f2' }}>
                      <SentimentVeryDissatisfied sx={{ color: '#ef4444', fontSize: 32, mb: 0.5 }} />
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#ef4444' }}>{captureResult.disengaged || 0}</Typography>
                      <Typography variant="caption" color="text.secondary">Disengaged</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#eff6ff' }}>
                      <SentimentSatisfied sx={{ color: '#3b82f6', fontSize: 32, mb: 0.5 }} />
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#3b82f6' }}>{captureResult.total_faces || 0}</Typography>
                      <Typography variant="caption" color="text.secondary">Total Faces</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fefce8' }}>
                      <Thermostat sx={{ color: '#f59e0b', fontSize: 32, mb: 0.5 }} />
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                        {captureResult.engagement_score ? `${Math.round(captureResult.engagement_score)}%` : '--'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Score</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {captureResult.engagement_score != null && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Overall Engagement</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={captureResult.engagement_score}
                      sx={{
                        height: 10, borderRadius: 5,
                        bgcolor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 5,
                          background: captureResult.engagement_score > 70
                            ? 'linear-gradient(90deg, #10b981, #14b8a6)'
                            : captureResult.engagement_score > 40
                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                              : 'linear-gradient(90deg, #ef4444, #f87171)',
                        },
                      }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
    </Box>
  )
}
