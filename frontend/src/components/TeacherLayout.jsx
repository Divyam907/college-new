import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Avatar, IconButton,
  Divider, Chip, useMediaQuery, useTheme
} from '@mui/material'
import {
  Dashboard, CameraAlt, Visibility, Assessment,
  Send, Logout, Menu as MenuIcon, School,
  DarkMode, LightMode
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useThemeMode } from './ThemeProvider'

const drawerWidth = 270

const navItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/teacher/dashboard' },
  { text: 'Mark Attendance', icon: <CameraAlt />, path: '/teacher/attendance' },
  { text: 'Liveness Monitor', icon: <Visibility />, path: '/teacher/liveness' },
  { text: 'Engagement Reports', icon: <Assessment />, path: '/teacher/engagement' },
  { text: 'Send Reports', icon: <Send />, path: '/teacher/reports' },
]

export default function TeacherLayout({ user, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { mode, toggleTheme } = useThemeMode()

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1e293b' }}>
      {/* Brand */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <School sx={{ color: '#818cf8', fontSize: 32 }} />
        <Box>
          <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700, lineHeight: 1.2 }}>
            AttendanceAI
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>Teacher Portal</Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Nav */}
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {navItems.map((item) => {
          const active = location.pathname === item.path || (item.path === '/teacher/dashboard' && location.pathname === '/teacher')
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false) }}
                sx={{
                  borderRadius: 2,
                  py: 1.3,
                  px: 2,
                  bgcolor: active ? 'rgba(99,102,241,0.25)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(99,102,241,0.15)' },
                }}
              >
                <ListItemIcon sx={{ color: active ? '#a5b4fc' : '#94a3b8', minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#ffffff' : '#cbd5e1',
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      {/* User section */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: '#6366f1', fontSize: 14 }}>
            {user?.name?.[0]?.toUpperCase() || 'T'}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.name || 'Teacher'}
            </Typography>
            <Chip label="Teacher" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }} />
          </Box>
        </Box>
        <ListItemButton onClick={onLogout} sx={{ borderRadius: 1.5, py: 0.8, color: '#f87171' }}>
          <ListItemIcon sx={{ color: '#f87171', minWidth: 32 }}><Logout fontSize="small" /></ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: '0.85rem', color: '#f87171' }} />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' } }}
        >
          {drawer}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, border: 'none', boxSizing: 'border-box' } }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Main content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: isMobile ? '100%' : `calc(100% - ${drawerWidth}px)` }}>
        {/* Top bar */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: theme.palette.background.paper, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Toolbar>
            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, flex: 1 }}>
              {navItems.find(i => i.path === location.pathname)?.text || 'Dashboard'}
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

        {/* Page content */}
        <Box component={motion.div} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          sx={{ flex: 1, p: 3, overflow: 'auto' }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
