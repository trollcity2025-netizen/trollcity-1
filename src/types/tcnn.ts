/**
 * TCNN Type Definitions
 * 
 * TypeScript interfaces and types for Troll City News Network
 */

// Article Types
export type ArticleStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected';
export type ArticleCategory = 'news' | 'sports' | 'entertainment' | 'politics' | 'technology' | 'community';

export interface TCNNArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImageUrl?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  status: ArticleStatus;
  submittedAt?: string;
  reviewedAt?: string;
  publishedAt?: string;
  reviewedBy?: string;
  category: ArticleCategory;
  tags: string[];
  isBreaking: boolean;
  viewCount: number;
  tipCount: number;
  tipTotalCoins: number;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

// Journalist Types
export interface JournalistStats {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  articlesCount: number;
  totalViews: number;
  totalTips: number;
  totalTipAmount: number;
}

// Ticker Types
export type TickerType = 'standard' | 'breaking';
export type TickerStatus = 'pending' | 'approved' | 'rejected';

export interface TCNNTicker {
  id: string;
  message: string;
  type: TickerType;
  status: TickerStatus;
  submittedBy: string;
  submitterName?: string;
  reviewedBy?: string;
  reviewerName?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// Tipping Types
export type TCNNCoinType = 'gold' | 'silver' | 'copper';

export interface TCNNTip {
  id: string;
  tipperId: string;
  tipperName: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  coinType: TCNNCoinType;
  articleId?: string;
  streamId?: string;
  message?: string;
  createdAt: string;
}

export interface TipInput {
  recipientId: string;
  amount: number;
  coinType: TCNNCoinType;
  articleId?: string;
  streamId?: string;
  message?: string;
}

// Role Types
export type TCNNRole = 'journalist' | 'news_caster' | 'chief_news_caster';

export interface TCNNRoleAssignment {
  id: string;
  userId: string;
  role: TCNNRole;
  assignedBy: string;
  assignedAt: string;
}

// Analytics Types
export interface TCNNAnalytics {
  articleViews: number;
  totalTips: number;
  tipAmount: number;
  engagement: number;
  period: 'daily' | 'weekly' | 'monthly';
}

// Component Props Types
export interface ArticleCardProps {
  article: TCNNArticle;
  onClick?: () => void;
  variant?: 'compact' | 'full';
}

export interface JournalistLeaderboardProps {
  journalists: JournalistStats[];
}

export interface BreakingBannerProps {
  message?: string;
  isBreaking?: boolean;
}

export interface TipJournalistButtonProps {
  recipientId: string;
  articleId?: string;
  streamId?: string;
  recipientName: string;
  size?: 'sm' | 'md' | 'lg';
}
