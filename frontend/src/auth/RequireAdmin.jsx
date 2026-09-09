import { useAuth } from './AuthContext'

function RequireAdmin({ children, fallback = null }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  if (loading || !isAuthenticated) return null
  if (!isAdmin) return fallback
  return children
}

export default RequireAdmin
