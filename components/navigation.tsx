'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { 
  HomeIcon, 
  PlusIcon, 
  ClockIcon, 
  HistoryIcon,
  SettingsIcon,
  LogOutIcon,
  MessageCircle,
  FileText,
  List,
  Bot,
  BarChart3,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useEffect, useState } from 'react'

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: HomeIcon },
  { name: '新規投稿', href: '/posts/new', icon: PlusIcon },
  { name: '予約投稿', href: '/posts/scheduled', icon: ClockIcon },
  { name: '投稿履歴', href: '/posts/history', icon: HistoryIcon },
  { name: 'テンプレート', href: '/auto-reply/templates', icon: FileText },
  { name: '自動返信ルール', href: '/auto-reply/rules', icon: Bot },
  { name: '返信プール', href: '/auto-reply/pools', icon: List },
  { name: '返信履歴', href: '/auto-reply/history', icon: MessageCircle },
  { name: '分析', href: '/auto-reply/analytics', icon: BarChart3 },
  { name: 'Webhookテスト', href: '/auto-reply/test', icon: List },
  { name: '設定', href: '/settings', icon: SettingsIcon },
  { name: 'システム管理', href: '/admin', icon: Shield, adminOnly: true },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)

  useEffect(() => {
    if (user) {
      checkAdminStatus()
    }
  }, [user])

  const checkAdminStatus = async () => {
    try {
      // システム管理者かどうかをAPIでチェック
      const response = await fetch('/api/auth/check-admin')
      const data = await response.json()
      setIsSystemAdmin(data.isAdmin || false)
    } catch (error) {
      console.error('Admin status check failed:', error)
      setIsSystemAdmin(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center h-16 px-4">
        <h1 className="text-xl font-bold">SmartThreads</h1>
      </div>
      <nav className="flex-1 px-4 pb-4 space-y-2">
        {navigation.map((item) => {
          // 管理者専用アイテムは管理者のみ表示
          if (item.adminOnly && !isSystemAdmin) {
            return null
          }
          
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 pb-4">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOutIcon className="mr-3 h-5 w-5" />
          ログアウト
        </Button>
      </div>
    </div>
  )
}