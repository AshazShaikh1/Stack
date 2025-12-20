import { vi } from "vitest";

export const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  // FIX: Added 'table' argument so TypeScript knows this function accepts a string
  from: vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        maybeSingle: vi.fn(),
      })),
      in: vi.fn(() => ({
        eq: vi.fn(),
        mockReturnValue: vi.fn(),
      })),
      order: vi.fn(),
      limit: vi.fn(),
      gte: vi.fn(),
    })),
    insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
    })),
    delete: vi.fn(() => ({ eq: vi.fn() })),
  })),
};
