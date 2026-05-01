import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, TextField, Button, Typography, Alert, IconButton,
  InputAdornment, Divider, Link
} from '@mui/material'
import { Visibility, VisibilityOff, School, PersonOutlined, LockOutlined } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { API_BASE } from '../../api'

export default function TeacherLogin({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isSignup ? `${API_BASE}/api/auth/signup` : `${API_BASE}/api/auth/login`
      const payload = isSignup
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email, password: form.password, role: 'teacher' }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      const data = await res.json()

      if (res.ok) {
        if (isSignup) {
          setIsSignup(false)
          setError('')
          alert('Account created! Please login.')
        } else {
          onLogin(data)
          navigate('/teacher/dashboard')
        }
      } else {
        setError(data.error || 'Login failed. Please try again.')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      p: 2,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card sx={{ maxWidth: 440, width: '100%', p: 5, position: 'relative', overflow: 'visible' }}>
          {/* Floating icon */}
          <Box sx={{
            position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
            width: 60, height: 60, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}>
            <School sx={{ color: '#fff', fontSize: 30 }} />
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3, mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Teacher Portal — AttendanceAI
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <TextField
                fullWidth
                label="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                sx={{ mb: 2 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlined color="action" /></InputAdornment> }}
                required
              />
            )}
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              sx={{ mb: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlined color="action" /></InputAdornment> }}
              required
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              required
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                fontSize: '1rem',
                '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
              }}
            >
              {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">
              {isSignup ? 'Already registered?' : "Don't have an account?"}
            </Typography>
          </Divider>

          <Button
            fullWidth
            variant="outlined"
            onClick={() => { setIsSignup(!isSignup); setError('') }}
            sx={{ borderColor: '#e2e8f0', color: '#6366f1' }}
          >
            {isSignup ? 'Back to Login' : 'Create Teacher Account'}
          </Button>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate('/college/login')}
              sx={{ color: '#64748b', textDecoration: 'none', '&:hover': { color: '#6366f1' } }}
            >
              College/Admin Portal →
            </Link>
          </Box>
        </Card>
      </motion.div>
    </Box>
  )
}
