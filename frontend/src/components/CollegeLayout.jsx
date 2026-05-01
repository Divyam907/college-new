import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Avatar, IconButton,
  Divider, Chip, useMediaQuery, useTheme
} from '@mui/material'
import {
  Dashboard, People, School, CalendarMonth, PersonAdd,
  Download, Visibility, Logout, Menu as MenuIcon, Business, AccountTree,
  DarkMode, LightMode
} from '@mui/icons-material'
import { useThemeMode } from './ThemeProvider'

const drawerWidth = 270

const navItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/college/dashboard' },
  { text: 'Batches & Branches', icon: <AccountTree />, path: '/college/structure' },
  { text: 'Timetable', icon: <CalendarMonth />, path: '/college/timetable' },
  { text: 'Teachers & HODs', icon: <School />, path: '/college/teachers' },
  { text: 'Students', icon: <PersonAdd />, path: '/college/students' },
  { text: 'Attendance Records', icon: <Download />, path: '/college/attendance' },
  { text: 'Liveness Monitor', icon: <Visibility />, path: '/college/liveness' },
]

export default function CollegeLayout({ user, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { mode, toggleTheme } = useThemeMode()

  const handleLogout = () => {
    onLogout()
    navigate('/college/login')
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1e293b' }}>
      {/* Brand */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Box sx={{ width: 50, height: 50, borderRadius: '50%', mx: 'auto', mb: 1,
                   background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                   display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Business sx={{ fontSize: 28, color: '#fff' }} />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.5, color: '#ffffff' }}>
          College Portal
        </Typography>
        <Chip label="Admin" size="small" sx={{ mt: 0.5, bgcolor: 'rgba(59,130,246,0.2)', color: '#93c5fd', fontSize: 11 }} />
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Nav */}
      <List sx={{ flex: 1, px: 1.5, py: 2 }}>
        {navItems.map(item => {
          const active = location.pathname === item.path
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false) }}
                sx={{
                  borderRadius: 2, py: 1.2,
                  bgcolor: active ? 'rgba(59,130,246,0.2)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.1)' },
                }}
              >
                <ListItemIcon sx={{ color: active ? '#60a5fa' : '#94a3b8', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400, color: active ? '#ffffff' : '#cbd5e1' }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* User */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: '#3b82f6', fontSize: 14 }}>
          {user?.name?.[0]?.toUpperCase() || 'C'}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500, fontSize: 13 }}>
            {user?.name || 'College Admin'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>
            {user?.email || ''}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleLogout} sx={{ color: '#ef4444' }}>
          <Logout fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      {/* Sidebar */}
      {isMobile ? (
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', border: 'none' } }}>
          {drawer}
        </Drawer>
      ) : (
        <Drawer variant="permanent"
          sx={{ width: drawerWidth, flexShrink: 0,
                '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', border: 'none' } }}>
          {drawer}
        </Drawer>
      )}

      {/* Main */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar with theme toggle */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: theme.palette.background.paper, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Toolbar>
            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, flex: 1 }}>
              {navItems.find(i => i.path === location.pathname)?.text || 'College Portal'}
            </Typography>
            <IconButton onClick={toggleTheme} sx={{ mr: 1 }}>
              {mode === 'dark' ? <LightMode sx={{ color: '#fbbf24' }} /> : <DarkMode sx={{ color: '#64748b' }} />}
            </IconButton>
            <Chip
              label={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              size="small"
              sx={{ bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#f1f5f9', color: theme.palette.text.secondary }}
            />
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto', width: '100%' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
