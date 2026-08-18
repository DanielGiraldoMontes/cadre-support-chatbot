import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/api/rateLimit";

type Row = { window_start: string; count: number };

function createFakeSupabase(seed: Record<string, Row> = {}) {
  const table: Record<string, Row> = { ...seed };

  const client = {
    from(_table: string) {
      let pendingKey: string | null = null;
      const builder = {
        select() {
          return builder;
        },
        eq(_col: string, key: string) {
          pendingKey = key;
          return builder;
        },
        maybeSingle() {
          const row = pendingKey ? (table[pendingKey] ?? null) : null;
          return Promise.resolve({ data: row, error: null });
        },
        insert(row: { key: string; window_start: string; count: number }) {
          table[row.key] = { window_start: row.window_start, count: row.count };
          return Promise.resolve({ error: null });
        },
        update(patch: Partial<Row>) {
          return {
            eq(_col: string, key: string) {
              table[key] = { ...table[key], ...patch } as Row;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, table };
}

describe("checkRateLimit", () => {
  it("allows requests under the cap", async () => {
    const { client } = createFakeSupabase();
    for (let i = 0; i < 20; i++) {
      const result = await checkRateLimit("1.2.3.4", client);
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects the request over the cap within the same window", async () => {
    const { client } = createFakeSupabase({
      "1.2.3.4": { window_start: new Date().toISOString(), count: 20 },
    });

    const result = await checkRateLimit("1.2.3.4", client);
    expect(result.allowed).toBe(false);
  });

  it("resets and allows once the window has expired", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { client } = createFakeSupabase({
      "1.2.3.4": { window_start: twoHoursAgo, count: 20 },
    });

    const result = await checkRateLimit("1.2.3.4", client);
    expect(result.allowed).toBe(true);
  });
});
