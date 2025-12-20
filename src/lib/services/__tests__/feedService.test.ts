import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase } from "@/test/mocks/supabase";

// 1. Mock MUST be defined here to hoist correctly
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockSupabase,
}));

// 2. Import service AFTER mock definition
import { getSavedFeed } from "../feedService";

describe("feedService.getSavedFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list if no saves found", async () => {
    // Cast to 'any' to avoid "missing insert/update/delete" error
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    } as any);

    const result = await getSavedFeed("user-123");
    expect(result).toEqual([]);
  });

  it("fetches collections when saves exist", async () => {
    const mockSaves = [{ target_type: "collection", target_id: "col-1" }];

    const selectBuilder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockSaves }),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };

    // FIX: Cast implementation to 'any' to satisfy TypeScript constraints
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "collections") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "col-1", title: "Test Stack", is_public: true }],
              }),
            }),
          }),
        } as any;
      }
      return { select: vi.fn(() => selectBuilder) } as any;
    });

    const result = await getSavedFeed("user-123");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "col-1", type: "collection" });
  });
});
