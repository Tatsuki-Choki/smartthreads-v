import { Navigation } from '@/components/navigation'
import { MobileNavigation } from '@/components/mobile-navigation'
import { AuthGuard } from '@/components/auth-guard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-gray-50">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col">
          <div className="flex flex-col flex-1 min-h-0 bg-white border-r border-gray-200">
            <Navigation />
          </div>
        </div>

        {/* Mobile Navigation */}
        <MobileNavigation />

        {/* Main content - モバイルでのパディング調整 */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            {/* モバイルではヘッダーとボトムナビの分のパディングを追加 */}
            <div className="lg:py-6 py-4 lg:pb-6 pb-20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* モバイルでは上部にヘッダー分の余白を追加 */}
                <div className="lg:mt-0 mt-14">
                  {children}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}