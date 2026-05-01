import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, TextField, Button, Typography, Alert, InputAdornment, Divider, Link
} from '@mui/material'
import { Business, PersonOutlined, LockOutlined, BadgeOutlined } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { API_BASE } from '../../api'

export default function CollegeLogin({ onLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const endpoint = isSignup ? `${API_BASE}/api/auth/signup` : `${API_BASE}/api/auth/login`
      const payload = isSignup
        ? { name: form.name, email: form.email, password: form.password, role: 'college' }
        : { email: form.email, password: form.password, role: 'college' }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        if (isSignup) {
          setSuccess(data.message || 'Account created! Please log in.')
          setIsSignup(false)
          setForm({ name: '', email: '', password: '' })
        } else {
          onLogin(data)
          navigate('/college/dashboard')
        }
      } else {
        setError(data.error || 'Something went wrong.')
      }
    } catch {
      setError('Network error.')
    }
    setLoading(false)
  }

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e2139 0%, #3d4471 100%)', p: 2,
    }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <Card sx={{ maxWidth: 440, width: '100%', p: 5, position: 'relative', overflow: 'visible' }}>
          <Box sx={{
            position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
            width: 60, height: 60, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e2139, #5661f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(30,33,57,0.4)',
          }}>
            <Business sx={{ color: '#fff', fontSize: 30 }} />
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3, mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {isSignup ? 'Create College Account' : 'College Portal'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isSignup ? 'Register as College Admin / Staff' : 'Admin & College Staff Login'}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <TextField fullWidth label="Full Name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                sx={{ mb: 2 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><BadgeOutlined color="action" /></InputAdornment> }}
                required
              />
            )}
            <TextField fullWidth label="Email" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              sx={{ mb: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlined color="action" /></InputAdornment> }}
              required
            />
            <TextField fullWidth label="Password" type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              sx={{ mb: 3 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment> }}
              required
            />
            <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}
              sx={{ py: 1.5, background: 'linear-gradient(135deg, #1e2139, #5661f6)', fontSize: '1rem' }}
            >
              {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {isSignup ? 'Already registered?' : "Don't have an account?"}
            </Typography>
            <Link component="button" variant="body2"
              onClick={() => { setIsSignup(!isSignup); setError(''); setSuccess('') }}
              sx={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}
            >
              {isSignup ? 'Back to Login' : 'Create College Account'}
            </Link>
          </Box>

          <Divider sx={{ my: 2 }} />
          <Box sx={{ textAlign: 'center' }}>
            <Link component="button" variant="body2" onClick={() => navigate('/teacher/login')}
              sx={{ color: '#6366f1', textDecoration: 'none' }}
            >
              ← Teacher Portal Login
            </Link>
          </Box>
        </Card>
      </motion.div>
    </Box>
  )
}
