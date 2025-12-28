import { supabase } from './supabase'

export const getUserRoles = async (): Promise<string[]> => {
  const { data: user, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.warn('Unable to read signed-in user roles:', userError?.message)
    return []
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to load user roles:', error)
    return []
  }

  return (data || []).map((row) => row.role)
}

export const isAdmin = async (): Promise<boolean> => {
  const roles = await getUserRoles()
  return roles.includes('admin')
}
