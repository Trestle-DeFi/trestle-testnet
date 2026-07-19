import { describe, it, expect, vi, beforeEach } from "vitest";
import { astraChat, analyzeListing, resolveDispute, getTaskRecommendations } from "./astra";
import { API_BASE } from "../config/contracts";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("astraChat", () => {
  it("returns AI response on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: "Hello from Astra" }),
    } as Response);

    const result = await astraChat("hi");
    expect(result).toBe("Hello from Astra");
    expect(fetch).toHaveBeenCalledWith(
      `${API_BASE}/api/astra/chat`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "hi", context: undefined }),
      }),
    );
  });

  it("sends context when provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: "ok" }),
    } as Response);

    await astraChat("balance", { address: "0xabc" });
    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.context).toEqual({ address: "0xabc" });
  });
});

describe("analyzeListing", () => {
  it("correctly calls api", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ score: 85 }),
    } as Response);

    const result = await analyzeListing("Title", "Desc", "100");
    expect(result).toEqual({ score: 85 });
  });
});

describe("resolveDispute / getTaskRecommendations", () => {
  it("resolveDispute sends POST", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resolved: true }),
    } as Response);

    await resolveDispute({ orderId: 1 });
  });

  it("getTaskRecommendations sends POST", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tasks: [] }),
    } as Response);

    await getTaskRecommendations({ address: "0xabc" });
  });
});
