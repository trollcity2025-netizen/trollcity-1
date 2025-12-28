import React from 'react'
import { useAdmin } from '../hooks/useAdmin'

interface AdminOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

const AdminOnly: React.FC<AdminOnlyProps> = ({ children, fallback = null }) => {
  const { isAdmin, loading } = useAdmin()

  if (loading) {
    return fallback
  }

  if (!isAdmin) {
    return fallback
  }

  return <>{children}</>
}

export default AdminOnly
