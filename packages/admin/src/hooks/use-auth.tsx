'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getDb } from '@/lib/cloudbase'
import type { AdminRole } from '@/lib/types'
import { writeAdminLog } from '@/lib/admin-log'

const ADMIN_ROLES: AdminRole[] = ['service', 'product_manager', 'system_admin']
const ADMIN_SESSION_KEY = 'dxdy_admin_profile'

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

const allowAnyPassword = process.env.NEXT_PUBLIC_ADMIN_ALLOW_ANY_PASSWORD === 'true'

function normalizeProfile(doc: CloudUser, fallbackId = ''): AdminProfile | null {
  if (!doc || !ADMIN_ROLES.includes(doc.role as AdminRole) || doc.status === 'disabled') return null
  return {
    id: String(doc._id || fallbackId),
    username: String(doc.username || ''),
    realName: String((doc as any).realName || doc.username || fallbackId),
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
    try {
      const stored = window.localStorage.getItem(ADMIN_SESSION_KEY)
      if (stored) setUser(JSON.parse(stored) as AdminProfile)
    } catch {
      window.localStorage.removeItem(ADMIN_SESSION_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await getDb().collection('users').where({ username }).limit(1).get()
    const doc = (res.data as CloudUser[])?.[0]
    const profile = doc ? normalizeProfile(doc) : null
    const storedPassword = String((doc as any)?.password || '')
    const passwordMatched = allowAnyPassword || !storedPassword || storedPassword === '***' || storedPassword === password
    if (!profile || !passwordMatched) {
      throw new Error('账号或密码错误')
    }
    setUser(profile)
    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(profile))
    writeAdminLog({ operator: profile, action: 'login', target: profile.id, detail: `管理员 ${profile.realName} 登录` }).catch(() => {})
  }, [])

  const signOut = useCallback(async () => {
    if (user) {
      writeAdminLog({ operator: user, action: 'logout', target: user.id, detail: `管理员 ${user.realName} 登出` }).catch(() => {})
    }
    window.localStorage.removeItem(ADMIN_SESSION_KEY)
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
