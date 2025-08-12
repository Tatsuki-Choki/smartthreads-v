export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug?: string
          owner_id?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          owner_id?: string
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
          created_at?: string
          updated_at?: string
        }
      }
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
          parent_post_id: string | null
          thread_root_id: string | null
          thread_position: number
          comment_count: number
          last_comment_at: string | null
          auto_reply_enabled: boolean
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
          thread_root_id?: string | null
          thread_position?: number
          comment_count?: number
          last_comment_at?: string | null
          auto_reply_enabled?: boolean
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
          thread_root_id?: string | null
          thread_position?: number
          comment_count?: number
          last_comment_at?: string | null
          auto_reply_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      reply_templates: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          content: string
          variables: Record<string, any>
          media_urls: string[]
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          content: string
          variables?: Record<string, any>
          media_urls?: string[]
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          content?: string
          variables?: Record<string, any>
          media_urls?: string[]
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      auto_reply_rules: {
        Row: {
          id: string
          workspace_id: string
          threads_account_id: string
          name: string
          description: string | null
          trigger_keywords: string[]
          exclude_keywords: string[]
          match_mode: 'any' | 'all' | 'exact'
          reply_template_id: string | null
          reply_content: string
          reply_delay_seconds: number
          max_replies_per_hour: number
          max_replies_per_user: number
          is_active: boolean
          priority: number
          use_ai: boolean
          ai_prompt: string | null
          ai_tone: 'friendly' | 'professional' | 'casual' | 'formal' | null
          ai_max_length: number
          account_ids: string[]
          rotation_mode: 'random' | 'round_robin' | 'least_used'
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
          exclude_keywords?: string[]
          match_mode?: 'any' | 'all' | 'exact'
          reply_template_id?: string | null
          reply_content: string
          reply_delay_seconds?: number
          max_replies_per_hour?: number
          max_replies_per_user?: number
          is_active?: boolean
          priority?: number
          use_ai?: boolean
          ai_prompt?: string | null
          ai_tone?: 'friendly' | 'professional' | 'casual' | 'formal' | null
          ai_max_length?: number
          account_ids?: string[]
          rotation_mode?: 'random' | 'round_robin' | 'least_used'
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
          exclude_keywords?: string[]
          match_mode?: 'any' | 'all' | 'exact'
          reply_template_id?: string | null
          reply_content?: string
          reply_delay_seconds?: number
          max_replies_per_hour?: number
          max_replies_per_user?: number
          is_active?: boolean
          priority?: number
          use_ai?: boolean
          ai_prompt?: string | null
          ai_tone?: 'friendly' | 'professional' | 'casual' | 'formal' | null
          ai_max_length?: number
          account_ids?: string[]
          rotation_mode?: 'random' | 'round_robin' | 'least_used'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          workspace_id: string
          threads_comment_id: string
          threads_post_id: string
          threads_user_id: string
          threads_parent_comment_id: string | null
          username: string
          display_name: string | null
          profile_picture_url: string | null
          content: string
          media_urls: string[]
          replied: boolean
          reply_post_id: string | null
          matched_rule_id: string | null
          reply_sent_at: string | null
          reply_error: string | null
          raw_data: Record<string, any> | null
          is_spam: boolean
          sentiment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          threads_comment_id: string
          threads_post_id: string
          threads_user_id: string
          threads_parent_comment_id?: string | null
          username: string
          display_name?: string | null
          profile_picture_url?: string | null
          content: string
          media_urls?: string[]
          replied?: boolean
          reply_post_id?: string | null
          matched_rule_id?: string | null
          reply_sent_at?: string | null
          reply_error?: string | null
          raw_data?: Record<string, any> | null
          is_spam?: boolean
          sentiment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          threads_comment_id?: string
          threads_post_id?: string
          threads_user_id?: string
          threads_parent_comment_id?: string | null
          username?: string
          display_name?: string | null
          profile_picture_url?: string | null
          content?: string
          media_urls?: string[]
          replied?: boolean
          reply_post_id?: string | null
          matched_rule_id?: string | null
          reply_sent_at?: string | null
          reply_error?: string | null
          raw_data?: Record<string, any> | null
          is_spam?: boolean
          sentiment?: string | null
          created_at?: string
        }
      }
      reply_queue: {
        Row: {
          id: string
          workspace_id: string
          comment_id: string
          rule_id: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          scheduled_for: string
          processed_at: string | null
          reply_content: string
          reply_media_urls: string[]
          retry_count: number
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          comment_id: string
          rule_id: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          scheduled_for: string
          processed_at?: string | null
          reply_content: string
          reply_media_urls?: string[]
          retry_count?: number
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          comment_id?: string
          rule_id?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          scheduled_for?: string
          processed_at?: string | null
          reply_content?: string
          reply_media_urls?: string[]
          retry_count?: number
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      auto_reply_logs: {
        Row: {
          id: string
          workspace_id: string
          comment_id: string | null
          rule_id: string | null
          threads_account_id: string | null
          event_type: string
          event_details: Record<string, any>
          processing_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          comment_id?: string | null
          rule_id?: string | null
          threads_account_id?: string | null
          event_type: string
          event_details?: Record<string, any>
          processing_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          comment_id?: string | null
          rule_id?: string | null
          threads_account_id?: string | null
          event_type?: string
          event_details?: Record<string, any>
          processing_time_ms?: number | null
          created_at?: string
        }
      }
      ai_generation_history: {
        Row: {
          id: string
          workspace_id: string
          rule_id: string | null
          comment_id: string | null
          prompt: string
          generated_content: string
          model_used: string | null
          tokens_used: number | null
          generation_time_ms: number | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          rule_id?: string | null
          comment_id?: string | null
          prompt: string
          generated_content: string
          model_used?: string | null
          tokens_used?: number | null
          generation_time_ms?: number | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          rule_id?: string | null
          comment_id?: string | null
          prompt?: string
          generated_content?: string
          model_used?: string | null
          tokens_used?: number | null
          generation_time_ms?: number | null
          created_at?: string
          created_by?: string | null
        }
      }
      account_usage_stats: {
        Row: {
          id: string
          workspace_id: string
          account_id: string
          total_replies: number
          replies_today: number
          replies_this_hour: number
          last_reply_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          account_id: string
          total_replies?: number
          replies_today?: number
          replies_this_hour?: number
          last_reply_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          account_id?: string
          total_replies?: number
          replies_today?: number
          replies_this_hour?: number
          last_reply_at?: string | null
          updated_at?: string
        }
      }
      comment_analytics: {
        Row: {
          id: string
          workspace_id: string
          comment_id: string
          sentiment: 'positive' | 'negative' | 'neutral' | null
          sentiment_score: number | null
          language: string | null
          topics: string[]
          entities: string[]
          response_time_seconds: number | null
          was_auto_replied: boolean
          manual_intervention: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          comment_id: string
          sentiment?: 'positive' | 'negative' | 'neutral' | null
          sentiment_score?: number | null
          language?: string | null
          topics?: string[]
          entities?: string[]
          response_time_seconds?: number | null
          was_auto_replied?: boolean
          manual_intervention?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          comment_id?: string
          sentiment?: 'positive' | 'negative' | 'neutral' | null
          sentiment_score?: number | null
          language?: string | null
          topics?: string[]
          entities?: string[]
          response_time_seconds?: number | null
          was_auto_replied?: boolean
          manual_intervention?: boolean
          created_at?: string
        }
      }
      reply_performance: {
        Row: {
          id: string
          workspace_id: string
          rule_id: string | null
          period_date: string
          total_replies: number
          successful_replies: number
          failed_replies: number
          avg_response_time_seconds: number | null
          total_likes: number
          total_replies_received: number
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          rule_id?: string | null
          period_date: string
          total_replies?: number
          successful_replies?: number
          failed_replies?: number
          avg_response_time_seconds?: number | null
          total_likes?: number
          total_replies_received?: number
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          rule_id?: string | null
          period_date?: string
          total_replies?: number
          successful_replies?: number
          failed_replies?: number
          avg_response_time_seconds?: number | null
          total_likes?: number
          total_replies_received?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_keyword_match: {
        Args: {
          p_content: string
          p_keywords: string[]
          p_exclude_keywords: string[]
          p_match_mode: string
        }
        Returns: boolean
      }
      check_auto_reply_rate_limit: {
        Args: {
          p_workspace_id: string
          p_threads_account_id: string
          p_rule_id: string
          p_threads_user_id: string
        }
        Returns: boolean
      }
      get_next_account_for_reply: {
        Args: {
          p_workspace_id: string
          p_rule_id: string
        }
        Returns: string
      }
      update_account_usage_stats: {
        Args: {
          p_workspace_id: string
          p_account_id: string
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}