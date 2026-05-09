'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { auth, db } from '@/lib/cloudbase'
import type { AdminRole } from '@/lib/types'
import { writeAdminLog } from '@/lib/admin-log'

const ADMIN_ROLES: AdminRole[] = ['service', 'product_manager', 'system_admin']

export interface AdminProfile {
  id: string
  username: string
  realName: string
  role: AdminRole
  permissions: Record<string, boolean>
  status: 'active' | 'disabled'
}

type CloudUser = Record<string, unknown> & {
  _id?: string
  username?: string
  role?: string
  status?: string
}

async function loadProfile(uid: string): Promise<AdminProfile | null> {
  const res = await db.collection('users').doc(uid).get()
  const docs = res.data as CloudUser[]
  const doc = docs?.[0]
  if (!doc || !ADMIN_ROLES.includes(doc.role as AdminRole) || doc.status === 'disabled') return null
  return {
    id: String(doc._id || uid),
    username: String(doc.username || ''),
    realName: String((doc as any).realName || doc.username || uid),
    role: doc.role as AdminRole,
    permissions: typeof doc.permissions === 'object' && doc.permissions ? doc.permissions as Record<string, boolean> : {},
    status: doc.status === 'disabled' ? 'disabled' : 'active',
  }
}

interface AuthContextValue {
  user: AdminProfile | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data } = auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        const profile = await loadProfile(session.user.id)
        setUser(profile)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
      setLoading(false)
    })
    return () => {
      data?.subscription?.unsubscribe?.()
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const { data, error }: any = await auth.signInWithPassword({ username, password })
    if (error) throw new Error(error.message || '登录失败')
    if (data?.user?.id) {
      const profile = await loadProfile(data.user.id)
      if (!profile) {
        await auth.signOut()
        throw new Error('非管理后台账号')
      }
      setUser(profile)
      writeAdminLog({ operator: profile, action: 'login', target: profile.id, detail: `管理员 ${profile.realName} 登录` }).catch(() => {})
    }
  }, [])

  const signOut = useCallback(async () => {
    if (user) {
      writeAdminLog({ operator: user, action: 'logout', target: user.id, detail: `管理员 ${user.realName} 登出` }).catch(() => {})
    }
    await auth.signOut()
    setUser(null)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
