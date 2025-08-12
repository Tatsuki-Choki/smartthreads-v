// ====================================
// SmartThreads V - Updated Database Types
// マイグレーション004対応の完全なタイプ定義
// 作成日: 2025-08-12
// ====================================

export type Database = {
  public: {
    Tables: {
      // ====================================
      // 基盤テーブル
      // ====================================
      
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          current_workspace_id: string | null
          preferences: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          current_workspace_id?: string | null
          preferences?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          current_workspace_id?: string | null
          preferences?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }

      workspaces: {
        Row: {
          id: string
          name: string
          slug: string | null
          owner_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
      }

      // ====================================
      // Threads連携テーブル
      // ====================================

      threads_accounts: {
        Row: {
          id: string
          workspace_id: string
          threads_user_id: string
          username: string
          access_token: string
          display_name: string | null
          profile_picture_url: string | null
          status: 'active' | 'invalid' | 'error' | 'suspended'
          expires_at: string | null
          last_used_at: string | null
          rate_limit_info: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          threads_user_id: string
          username: string
          access_token: string
          display_name?: string | null
          profile_picture_url?: string | null
          status?: 'active' | 'invalid' | 'error' | 'suspended'
          expires_at?: string | null
          last_used_at?: string | null
          rate_limit_info?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          threads_user_id?: string
          username?: string
          access_token?: string
          display_name?: string | null
          profile_picture_url?: string | null
          status?: 'active' | 'invalid' | 'error' | 'suspended'
          expires_at?: string | null
          last_used_at?: string | null
          rate_limit_info?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }

      // ====================================
      // 投稿管理テーブル
      // ====================================

      posts: {
        Row: {
          id: string
          workspace_id: string
          threads_account_id: string
          content: string
          status: 'draft' | 'scheduled' | 'published' | 'failed'
          scheduled_at: string | null
          published_at: string | null
          threads_post_id: string | null
          error_message: string | null
          parent_post_id: string | null  // ツリー投稿用
          quoted_post_id: string | null  // 引用投稿用
          media_urls: string[]  // 添付メディアURL配列
          media_types: string[]  // メディアタイプ配列
          post_type: string  // 投稿タイプ
          retry_count: number
          last_retry_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          threads_account_id: string
          content: string
          status?: 'draft' | 'scheduled' | 'published' | 'failed'
          scheduled_at?: string | null
          published_at?: string | null
          threads_post_id?: string | null
          error_message?: string | null
          parent_post_id?: string | null
          quoted_post_id?: string | null
          media_urls?: string[]
          media_types?: string[]
          post_type?: string
          retry_count?: number
          last_retry_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          threads_account_id?: string
          content?: string
          status?: 'draft' | 'scheduled' | 'published' | 'failed'
          scheduled_at?: string | null
          published_at?: string | null
          threads_post_id?: string | null
          error_message?: string | null
          parent_post_id?: string | null
          quoted_post_id?: string | null
          media_urls?: string[]
          media_types?: string[]
          post_type?: string
          retry_count?: number
          last_retry_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // ====================================
      // 自動返信機能テーブル
      // ====================================

      auto_reply_rules: {
        Row: {
          id: string
          workspace_id: string
          threads_account_id: string
          name: string
          description: string | null
          trigger_keywords: string[]
          trigger_mode: 'any' | 'all' | 'exact'
          reply_template: string
          reply_delay_seconds: number
          max_replies_per_hour: number
          is_active: boolean
          priority: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          threads_account_id: string
          name: string
          description?: string | null
          trigger_keywords: string[]
          trigger_mode?: 'any' | 'all' | 'exact'
          reply_template: string
          reply_delay_seconds?: number
          max_replies_per_hour?: number
          is_active?: boolean
          priority?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          threads_account_id?: string
          name?: string
          description?: string | null
          trigger_keywords?: string[]
          trigger_mode?: 'any' | 'all' | 'exact'
          reply_template?: string
          reply_delay_seconds?: number
          max_replies_per_hour?: number
          is_active?: boolean
          priority?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      comments: {
        Row: {
          id: string
          workspace_id: string
          post_id: string | null
          threads_comment_id: string
          threads_post_id: string
          threads_user_id: string
          username: string
          display_name: string | null
          content: string
          media_urls: string[]
          replied: boolean
          reply_id: string | null
          matched_rule_id: string | null
          reply_sent_at: string | null
          raw_data: Record<string, any> | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          post_id?: string | null
          threads_comment_id: string
          threads_post_id: string
          threads_user_id: string
          username: string
          display_name?: string | null
          content: string
          media_urls?: string[]
          replied?: boolean
          reply_id?: string | null
          matched_rule_id?: string | null
          reply_sent_at?: string | null
          raw_data?: Record<string, any> | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          post_id?: string | null
          threads_comment_id?: string
          threads_post_id?: string
          threads_user_id?: string
          username?: string
          display_name?: string | null
          content?: string
          media_urls?: string[]
          replied?: boolean
          reply_id?: string | null
          matched_rule_id?: string | null
          reply_sent_at?: string | null
          raw_data?: Record<string, any> | null
          created_at?: string
        }
      }

      // ====================================
      // システム管理テーブル
      // ====================================

      event_logs: {
        Row: {
          id: string
          workspace_id: string | null
          user_id: string | null
          event_type: string
          event_action: string
          resource_type: string | null
          resource_id: string | null
          details: Record<string, any>
          ip_address: string | null
          user_agent: string | null
          success: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          user_id?: string | null
          event_type: string
          event_action: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Record<string, any>
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          user_id?: string | null
          event_type?: string
          event_action?: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Record<string, any>
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
      }

      rate_limits: {
        Row: {
          id: string
          workspace_id: string
          threads_account_id: string
          limit_type: string
          current_count: number
          limit_value: number
          reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          threads_account_id: string
          limit_type: string
          current_count?: number
          limit_value: number
          reset_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          threads_account_id?: string
          limit_type?: string
          current_count?: number
          limit_value?: number
          reset_at?: string
          created_at?: string
          updated_at?: string
        }
      }

      system_settings: {
        Row: {
          key: string
          value: Record<string, any>
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          value: Record<string, any>
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Record<string, any>
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      // ====================================
      // カスタム関数の型定義
      // ====================================
      
      create_workspace_with_defaults: {
        Args: {
          workspace_name: string
          workspace_slug?: string
          owner_user_id?: string
        }
        Returns: string
      }
      
      check_rate_limit: {
        Args: {
          p_workspace_id: string
          p_threads_account_id: string
          p_limit_type: string
          p_limit_value?: number
        }
        Returns: boolean
      }
      
      increment_rate_limit: {
        Args: {
          p_workspace_id: string
          p_threads_account_id: string
          p_limit_type: string
        }
        Returns: void
      }
    }
    Enums: {
      // ====================================
      // Enum型定義
      // ====================================
      
      post_status: 'draft' | 'scheduled' | 'published' | 'failed'
      account_status: 'active' | 'invalid' | 'error' | 'suspended'
      workspace_role: 'owner' | 'admin' | 'member' | 'viewer'
      post_type: 'text' | 'image' | 'video' | 'carousel' | 'reply' | 'quote'
      trigger_mode: 'any' | 'all' | 'exact'
      event_type: 'auth' | 'post' | 'comment' | 'admin' | 'api' | 'error' | 'system'
      event_action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'view' | 'migration'
    }
  }
}

// ====================================
// 追加のヘルパー型定義
// ====================================

// 投稿関連の型定義
export type PostWithRelations = Database['public']['Tables']['posts']['Row'] & {
  threads_account?: Database['public']['Tables']['threads_accounts']['Row']
  parent_post?: Database['public']['Tables']['posts']['Row']
  quoted_post?: Database['public']['Tables']['posts']['Row']
  comments?: Database['public']['Tables']['comments']['Row'][]
}

// ワークスペース関連の型定義
export type WorkspaceWithMembers = Database['public']['Tables']['workspaces']['Row'] & {
  members?: (Database['public']['Tables']['workspace_members']['Row'] & {
    user?: Database['public']['Tables']['users']['Row']
  })[]
  threads_accounts?: Database['public']['Tables']['threads_accounts']['Row'][]
}

// 自動返信ルール関連の型定義
export type AutoReplyRuleWithAccount = Database['public']['Tables']['auto_reply_rules']['Row'] & {
  threads_account?: Database['public']['Tables']['threads_accounts']['Row']
}

// コメント関連の型定義
export type CommentWithReplies = Database['public']['Tables']['comments']['Row'] & {
  matched_rule?: Database['public']['Tables']['auto_reply_rules']['Row']
  reply_post?: Database['public']['Tables']['posts']['Row']
}

// イベントログ関連の型定義
export type EventLogWithUser = Database['public']['Tables']['event_logs']['Row'] & {
  user?: Database['public']['Tables']['users']['Row']
  workspace?: Database['public']['Tables']['workspaces']['Row']
}

// レート制限関連の型定義
export type RateLimitWithAccount = Database['public']['Tables']['rate_limits']['Row'] & {
  threads_account?: Database['public']['Tables']['threads_accounts']['Row']
}

// ====================================
// API レスポンス型定義
// ====================================

export type ApiResponse<T = any> = {
  data?: T
  error?: string
  message?: string
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ====================================
// フォーム用型定義
// ====================================

export type CreatePostForm = {
  content: string
  post_type: Database['public']['Enums']['post_type']
  scheduled_at?: string
  parent_post_id?: string
  quoted_post_id?: string
  media_urls?: string[]
  media_types?: string[]
}

export type CreateAutoReplyRuleForm = {
  name: string
  description?: string
  trigger_keywords: string[]
  trigger_mode: Database['public']['Enums']['trigger_mode']
  reply_template: string
  reply_delay_seconds?: number
  max_replies_per_hour?: number
  priority?: number
}

export type CreateWorkspaceForm = {
  name: string
  slug?: string
}

// ====================================
// Webhook用型定義
// ====================================

export type ThreadsWebhookPayload = {
  object: string
  entry: Array<{
    id: string
    time: number
    changes: Array<{
      value: {
        thread_id?: string
        parent_id?: string
        text?: string
        username?: string
        media?: Array<{
          type: string
          url: string
        }>
      }
      field: string
    }>
  }>
}

// ====================================
// エクスポート
// ====================================

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]