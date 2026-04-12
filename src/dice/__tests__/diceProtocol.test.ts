/**
 * Story 34-5: Dice protocol type completeness tests.
 *
 * Verifies that the UI protocol types mirror the Rust wire types from
 * sidequest-protocol (34-2). These types must exist before the DiceOverlay
 * can consume WebSocket messages.
 *
 * RED phase — all tests FAIL until Dev adds the types.
 */
import { describe, it, expect } from "vitest";
import { MessageType } from "../../types/protocol";
import type { TypedGameMessage } from "../../types/payloads";

// ══════════════════════════════════════════════════════════════════════════════
// AC: MessageType enum includes dice variants
// ══════════════════════════════════════════════════════════════════════════════

describe("Protocol: MessageType enum includes dice variants", () => {
  it("MessageType enum includes DICE_REQUEST", () => {
    expect(MessageType.DICE_REQUEST).toBe("DICE_REQUEST");
  });

  it("MessageType enum includes DICE_THROW", () => {
    expect(MessageType.DICE_THROW).toBe("DICE_THROW");
  });

  it("MessageType enum includes DICE_RESULT", () => {
    expect(MessageType.DICE_RESULT).toBe("DICE_RESULT");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC: Payload interfaces match Rust wire types
// ══════════════════════════════════════════════════════════════════════════════

describe("Protocol: DiceRequestPayload interface", () => {
  it("DiceRequestPayload is exported from payloads module", async () => {
    const mod = await import("../../types/payloads");
    // The type exists as an interface — check via the type guard
    expect(typeof mod.isDiceRequest).toBe("function");
  });

  it("DiceRequestPayload has required fields matching Rust struct", async () => {
    // Construct a valid payload and verify TypeScript accepts it
    const payload: import("../../types/payloads").DiceRequestPayload = {
      request_id: "req-001",
      rolling_player_id: "player-1",
      character_name: "Kira",
      dice: [{ sides: 20, count: 1 }],
      modifier: 3,
      stat: "dexterity",
      difficulty: 15,
      context: "The lock resists your touch...",
    };
    expect(payload.request_id).toBe("req-001");
    expect(payload.rolling_player_id).toBe("player-1");
    expect(payload.character_name).toBe("Kira");
    expect(payload.dice).toHaveLength(1);
    expect(payload.dice[0].sides).toBe(20);
    expect(payload.dice[0].count).toBe(1);
    expect(payload.modifier).toBe(3);
    expect(payload.stat).toBe("dexterity");
    expect(payload.difficulty).toBe(15);
    expect(payload.context).toBe("The lock resists your touch...");
  });
});

describe("Protocol: DiceThrowPayload interface", () => {
  it("DiceThrowPayload is exported from payloads module", async () => {
    const mod = await import("../../types/payloads");
    expect(typeof mod.isDiceThrow).toBe("function");
  });

  it("DiceThrowPayload has required fields matching Rust struct", async () => {
    const payload: import("../../types/payloads").DiceThrowPayload = {
      request_id: "req-001",
      throw_params: {
        velocity: [1.0, 2.0, -3.0],
        angular: [10.0, -5.0, 8.0],
        position: [0.5, 0.5],
      },
    };
    expect(payload.request_id).toBe("req-001");
    expect(payload.throw_params.velocity).toEqual([1.0, 2.0, -3.0]);
    expect(payload.throw_params.angular).toEqual([10.0, -5.0, 8.0]);
    expect(payload.throw_params.position).toEqual([0.5, 0.5]);
  });
});

describe("Protocol: DiceResultPayload interface", () => {
  it("DiceResultPayload is exported from payloads module", async () => {
    const mod = await import("../../types/payloads");
    expect(typeof mod.isDiceResult).toBe("function");
  });

  it("DiceResultPayload has required fields matching Rust struct", async () => {
    const payload: import("../../types/payloads").DiceResultPayload = {
      request_id: "req-001",
      rolling_player_id: "player-1",
      character_name: "Kira",
      rolls: [{ spec: { sides: 20, count: 1 }, faces: [17] }],
      modifier: 3,
      total: 20,
      difficulty: 15,
      outcome: "Success",
      seed: 12345,
      throw_params: {
        velocity: [1.0, 2.0, -3.0],
        angular: [10.0, -5.0, 8.0],
        position: [0.5, 0.5],
      },
    };
    expect(payload.request_id).toBe("req-001");
    expect(payload.rolling_player_id).toBe("player-1");
    expect(payload.rolls[0].faces).toEqual([17]);
    expect(payload.total).toBe(20);
    expect(payload.difficulty).toBe(15);
    expect(payload.outcome).toBe("Success");
    expect(payload.seed).toBe(12345);
    expect(payload.throw_params.velocity).toEqual([1.0, 2.0, -3.0]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC: Supporting types — DieSpec, ThrowParams, RollOutcome, DieGroupResult
// ══════════════════════════════════════════════════════════════════════════════

describe("Protocol: Supporting dice types", () => {
  it("DieSpec has sides (number) and count (number) fields", async () => {
    const spec: import("../../types/payloads").DieSpec = { sides: 20, count: 1 };
    expect(spec.sides).toBe(20);
    expect(spec.count).toBe(1);
  });

  it("DieSpec supports all standard die sizes from DieSides enum", async () => {
    const standardSizes = [4, 6, 8, 10, 12, 20, 100];
    for (const size of standardSizes) {
      const spec: import("../../types/payloads").DieSpec = { sides: size, count: 1 };
      expect(spec.sides).toBe(size);
    }
  });

  it("ThrowParams has velocity [3], angular [3], position [2]", async () => {
    const params: import("../../types/payloads").DiceThrowParams = {
      velocity: [1.0, 2.0, 3.0],
      angular: [4.0, 5.0, 6.0],
      position: [0.5, 0.5],
    };
    expect(params.velocity).toHaveLength(3);
    expect(params.angular).toHaveLength(3);
    expect(params.position).toHaveLength(2);
  });

  it("RollOutcome includes all four outcome variants", async () => {
    const outcomes: import("../../types/payloads").RollOutcome[] = [
      "CritSuccess",
      "Success",
      "Fail",
      "CritFail",
    ];
    expect(outcomes).toHaveLength(4);
    // Each must be a distinct string
    expect(new Set(outcomes).size).toBe(4);
  });

  it("DieGroupResult pairs spec with faces", async () => {
    const result: import("../../types/payloads").DieGroupResult = {
      spec: { sides: 20, count: 1 },
      faces: [17],
    };
    expect(result.spec.sides).toBe(20);
    expect(result.faces).toEqual([17]);
    expect(result.faces.length).toBe(result.spec.count);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC: Type guards exist for discriminated union
// ══════════════════════════════════════════════════════════════════════════════

describe("Protocol: Dice type guards", () => {
  it("isDiceRequest correctly identifies DICE_REQUEST messages", async () => {
    const { isDiceRequest } = await import("../../types/payloads");
    const msg = {
      type: MessageType.DICE_REQUEST,
      player_id: "server",
      payload: {
        request_id: "req-001",
        rolling_player_id: "player-1",
        character_name: "Kira",
        dice: [{ sides: 20, count: 1 }],
        modifier: 3,
        stat: "dexterity",
        difficulty: 15,
        context: "The lock resists...",
      },
    };
    expect(isDiceRequest(msg as unknown as TypedGameMessage)).toBe(true);
  });

  it("isDiceResult correctly identifies DICE_RESULT messages", async () => {
    const { isDiceResult } = await import("../../types/payloads");
    const msg = {
      type: MessageType.DICE_RESULT,
      player_id: "server",
      payload: {
        request_id: "req-001",
        rolling_player_id: "player-1",
        character_name: "Kira",
        rolls: [{ spec: { sides: 20, count: 1 }, faces: [17] }],
        modifier: 3,
        total: 20,
        difficulty: 15,
        outcome: "Success",
        seed: 12345,
        throw_params: { velocity: [0, 0, 0], angular: [0, 0, 0], position: [0, 0] },
      },
    };
    expect(isDiceResult(msg as unknown as TypedGameMessage)).toBe(true);
  });

  it("isDiceThrow correctly identifies DICE_THROW messages", async () => {
    const { isDiceThrow } = await import("../../types/payloads");
    const msg = {
      type: MessageType.DICE_THROW,
      player_id: "player-1",
      payload: {
        request_id: "req-001",
        throw_params: { velocity: [0, 0, 0], angular: [0, 0, 0], position: [0, 0] },
      },
    };
    expect(isDiceThrow(msg as unknown as TypedGameMessage)).toBe(true);
  });

  it("isDiceRequest returns false for non-dice messages", async () => {
    const { isDiceRequest } = await import("../../types/payloads");
    const msg = {
      type: MessageType.NARRATION,
      player_id: "server",
      payload: { text: "hello" },
    };
    expect(isDiceRequest(msg as unknown as TypedGameMessage)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC: TypedGameMessage union includes dice message types
// ══════════════════════════════════════════════════════════════════════════════

describe("Protocol: TypedGameMessage includes dice variants", () => {
  it("DiceRequestMessage is part of TypedGameMessage union", async () => {
    // If the type is in the union, this import + construction should compile
    const mod = await import("../../types/payloads");
    expect(mod).toHaveProperty("isDiceRequest");
  });

  it("DiceResultMessage is part of TypedGameMessage union", async () => {
    const mod = await import("../../types/payloads");
    expect(mod).toHaveProperty("isDiceResult");
  });

  it("DiceThrowMessage is part of TypedGameMessage union", async () => {
    const mod = await import("../../types/payloads");
    expect(mod).toHaveProperty("isDiceThrow");
  });
});
