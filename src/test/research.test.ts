import { describe, it, expect, vi } from 'vitest';

// Mock Supabase
const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { organization_id: 'org123' }, error: null })),
        })),
      })),
    })),
  },
}));

describe('Legal Research Flow', () => {
  it('should call the research edge function with correct parameters', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        answer: 'Based on Supreme Court precedents...',
        citations: [{ n: 1, title: 'Case A', court: 'Supreme Court' }],
      },
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const response = await supabase.functions.invoke('research', {
      body: { query: 'What is the rule for bail in PMLA?' },
    });

    expect(mockInvoke).toHaveBeenCalledWith('research', {
      body: { query: 'What is the rule for bail in PMLA?' },
    });
    expect(response.data.answer).toContain('Supreme Court');
  });

  it('should handle AI synthesis failures gracefully', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'AI synthesis failed' },
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const response = await supabase.functions.invoke('research', {
      body: { query: 'invalid query' },
    });

    expect(response.error).not.toBeNull();
    expect(response.error?.message).toBe('AI synthesis failed');
  });
});
