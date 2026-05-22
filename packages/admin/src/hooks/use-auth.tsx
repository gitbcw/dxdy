'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { callFunction } from '@/lib/cloudbase'
import type { AdminRole } from '@/lib/types'
import { writeAdminLog } from '@/lib/admin-log'
import { hasUsableToken } from './auth-helpers'

const ADMIN_SESSION_KEY = 'dxdy_admin_profile'

export interface AdminProfile {
  id: string
  username: string
  realName: string
  role: AdminRole
  permissions: Record<string, boolean>
  status: 'active' | 'disabled'
  token?: string
}

const allowAnyPassword = process.env.NEXT_PUBLIC_ADMIN_ALLOW_ANY_PASSWORD === 'true'

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
      if (stored) {
        const profile = JSON.parse(stored) as AdminProfile
        if (hasUsableToken(profile)) {
          setUser(profile)
        } else {
          window.localStorage.removeItem(ADMIN_SESSION_KEY)
        }
      }
    } catch {
      window.localStorage.removeItem(ADMIN_SESSION_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await callFunction<{ success?: boolean; error?: string; profile?: AdminProfile; token?: string }>('adminLogin', {
      username,
      password,
      allowAnyPassword,
    })
    if (!result.success || !result.profile || !result.token) throw new Error(result.error || '账号或密码错误')
    const profile = { ...result.profile, token: result.token }
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
