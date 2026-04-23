import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { usePeerEventCache } from "../usePeerEventCache";
import { PeerEventStore } from "@/lib/peerEventStore";

describe("usePeerEventCache", () => {
  it("starts at seq=0 before the store opens", () => {
    const { result } = renderHook(() => usePeerEventCache("slug-a", "alice"));
    // `getLatestSeq` is ref-backed; before IDB resolves it returns 0.
    expect(result.current.getLatestSeq()).toBe(0);
  });

  it("surfaces the max seq from a pre-populated store after open resolves", async () => {
    // Seed the store under the same (slug, playerId) key before the hook opens.
    const pre = await PeerEventStore.open("slug-seeded", "alice");
    await pre.append({ seq: 5, kind: "NARRATION", payload: { text: "hi" } });
    await pre.append({ seq: 12, kind: "NARRATION", payload: { text: "there" } });

    const { result } = renderHook(() => usePeerEventCache("slug-seeded", "alice"));
    // IDB open is async; wait for the ref to catch up.
    await waitFor(() => expect(result.current.getLatestSeq()).toBe(12));
  });

  it("bumps latestSeq forward on appendEvent, monotonic", async () => {
    const { result } = renderHook(() => usePeerEventCache("slug-monotonic", "alice"));
    // Wait for the initial open to settle so appendEvent has a store reference.
    await waitFor(() => expect(result.current.getLatestSeq()).toBe(0));

    await act(async () => {
      await result.current.appendEvent({ seq: 3, kind: "NARRATION", payload: {} });
    });
    expect(result.current.getLatestSeq()).toBe(3);

    // Out-of-order older event must NOT lower the high-water mark.
    await act(async () => {
      await result.current.appendEvent({ seq: 1, kind: "NARRATION", payload: {} });
    });
    expect(result.current.getLatestSeq()).toBe(3);

    await act(async () => {
      await result.current.appendEvent({ seq: 7, kind: "NARRATION", payload: {} });
    });
    expect(result.current.getLatestSeq()).toBe(7);
  });

  it("scopes by slug+playerId (alice and bob don't share a store)", async () => {
    const aliceStore = await PeerEventStore.open("slug-scope", "alice");
    await aliceStore.append({ seq: 9, kind: "NARRATION", payload: {} });

    const { result } = renderHook(() => usePeerEventCache("slug-scope", "bob"));
    // Bob's store is empty — alice's seq=9 must not leak. We give the open a
    // tick to resolve before asserting.
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.getLatestSeq()).toBe(0);
  });

  it("resets to 0 when slug or playerId is missing", () => {
    const { result, rerender } = renderHook(
      ({ slug, name }: { slug: string | undefined; name: string | null }) =>
        usePeerEventCache(slug, name),
      {
        initialProps: { slug: undefined as string | undefined, name: null as string | null },
      },
    );
    expect(result.current.getLatestSeq()).toBe(0);
    rerender({ slug: "some-slug", name: null });
    expect(result.current.getLatestSeq()).toBe(0);
  });
});
