'use client'

import { useState, useEffect } from 'react'
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
  Bot,
  BarChart3,
  List,
  Menu,
  X,
  ChevronLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: HomeIcon },
  { name: '新規投稿', href: '/posts/new', icon: PlusIcon },
  { name: '予約投稿', href: '/posts/scheduled', icon: ClockIcon },
  { name: '投稿履歴', href: '/posts/history', icon: HistoryIcon },
  { name: '自動返信ルール', href: '/auto-reply/rules', icon: Bot },
  { name: '返信履歴', href: '/auto-reply/history', icon: MessageCircle },
  { name: '分析', href: '/auto-reply/analytics', icon: BarChart3 },
  { name: 'Webhookテスト', href: '/auto-reply/test', icon: List },
  { name: '設定', href: '/settings', icon: SettingsIcon },
]

// 主要なボトムナビゲーション項目
const bottomNavItems = [
  { name: 'ホーム', href: '/dashboard', icon: HomeIcon },
  { name: '新規投稿', href: '/posts/new', icon: PlusIcon },
  { name: '予約', href: '/posts/scheduled', icon: ClockIcon },
  { name: '履歴', href: '/posts/history', icon: HistoryIcon },
  { name: '設定', href: '/settings', icon: SettingsIcon },
]

export function MobileNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showBackButton, setShowBackButton] = useState(false)

  useEffect(() => {
    // ダッシュボード以外のページでは戻るボタンを表示
    setShowBackButton(pathname !== '/dashboard' && pathname !== '/' && pathname !== '/login')
  }, [pathname])

  const handleLogout = async () => {
    await signOut()
    router.push('/')
    setIsOpen(false)
  }

  const handleBack = () => {
    router.back()
  }

  // 現在のページタイトルを取得
  const currentPageTitle = navigation.find(item => item.href === pathname)?.name || 'SmartThreads'

  return (
    <>
      {/* モバイルヘッダー（固定） */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            {showBackButton ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-2"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : (
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle>SmartThreads</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto px-3 py-4">
                      {navigation.map((item) => {
                        const isActive = pathname === item.href
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={clsx(
                              'flex items-center gap-3 px-3 py-2 mb-1 text-sm font-medium rounded-md transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {item.name}
                          </Link>
                        )
                      })}
                    </div>
                    <div className="border-t px-3 py-4">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-muted-foreground"
                        onClick={handleLogout}
                      >
                        <LogOutIcon className="mr-3 h-5 w-5" />
                        ログアウト
                      </Button>
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
            )}
          </div>
          
          <h1 className="text-lg font-semibold truncate flex-1 text-center">
            {currentPageTitle}
          </h1>
          
          <div className="w-10" /> {/* バランスを取るためのスペーサー */}
        </div>
      </div>

      {/* ボトムナビゲーション（モバイルのみ） */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg safe-area-bottom">
        <div className="grid grid-cols-5 h-16">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 text-xs',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* コンテンツのスペーサー（ヘッダーとボトムナビの高さ分） */}
      <div className="lg:hidden h-14" />
    </>
  )
}