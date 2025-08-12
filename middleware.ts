import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // 認証不要なパスをスキップ
  // 一時的に認証を完全に無効化（開発用）
  const authRequiredPaths: string[] = [] // すべてのパスで認証不要
  const pathname = request.nextUrl.pathname
  const isAuthRequired = authRequiredPaths.some(path => 
    pathname.startsWith(path)
  )

  if (process.env.NODE_ENV !== 'production') {
    console.log('Middleware実行:', {
      pathname,
      isAuthRequired,
      cookies: request.cookies.getAll().map(c => c.name),
    })
  }

  if (isAuthRequired) {
    // 認証が必要なページのみセッションチェック
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Middleware認証チェック:', {
        pathname,
        hasUser: !!user,
        userEmail: user?.email,
        error: error?.message,
      })
    }
    
    if (error || !user) {
      // 未認証の場合はログインページにリダイレクト
      if (process.env.NODE_ENV !== 'production') {
        console.log('未認証のためリダイレクト:', pathname)
      }
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
