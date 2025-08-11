import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">SmartThreads</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Threads自動運用ツール
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            ログイン
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition"
          >
            新規登録
          </Link>
        </div>
      </div>
    </main>
  )
}