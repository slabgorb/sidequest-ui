export type GameMode = "solo" | "multiplayer";

export function ModePicker({
  value,
  onChange,
}: {
  value: GameMode;
  onChange: (m: GameMode) => void;
}) {
  return (
    <fieldset>
      <legend>Mode</legend>
      <label>
        <input
          type="radio"
          name="mode"
          value="solo"
          checked={value === "solo"}
          onChange={() => onChange("solo")}
        />
        Solo
      </label>
      <label>
        <input
          type="radio"
          name="mode"
          value="multiplayer"
          checked={value === "multiplayer"}
          onChange={() => onChange("multiplayer")}
        />
        Multiplayer
      </label>
    </fieldset>
  );
}
