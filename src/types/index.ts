export type UserRole = 'free' | 'pro' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  credits_remaining: number;
}

export interface Judgment {
  id: string;
  title: string;
  court: string;
  citation: string;
  decision_date?: string;
  headnote?: string;
  summary?: string;
  full_text?: string;
  embedding?: number[];
}

export type MatterStatus = 'active' | 'closed' | 'archived' | 'pending';

export interface Matter {
  id: string;
  title: string;
  status: MatterStatus;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  provider_id: string;
  plan: string;
  status: string;
  current_period_end?: string;
  created_at: string;
}
