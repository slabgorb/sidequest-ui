import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterCreation } from "../CharacterCreation";

describe("CharacterCreation loading view", () => {
  it("renders the heartbeat dot alongside the wait copy", () => {
    render(
      <CharacterCreation scene={null} loading={true} onRespond={() => {}} />,
    );
    const loading = screen.getByTestId("creation-loading");
    expect(loading).toBeInTheDocument();
    expect(loading).toHaveTextContent(/waiting for the narrator/i);

    const dot = screen.getByTestId("chargen-heartbeat-dot");
    expect(dot).toBeInTheDocument();
    expect(dot.className).toMatch(/animate-pulse/);
    expect(dot.className).toMatch(/bg-emerald-500/);
  });

  it("uses the genre-pack scene loading_text when provided", () => {
    render(
      <CharacterCreation
        scene={
          {
            scene_index: 1,
            total_scenes: 4,
            loading_text: "The bones are casting...",
          } as never
        }
        loading={true}
        onRespond={() => {}}
      />,
    );
    expect(screen.getByTestId("creation-loading")).toHaveTextContent(
      /the bones are casting/i,
    );
    // Heartbeat must still render even with custom copy.
    expect(screen.getByTestId("chargen-heartbeat-dot")).toBeInTheDocument();
  });
});
