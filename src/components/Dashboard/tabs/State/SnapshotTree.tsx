import { useState } from "react";

interface SnapshotTreeProps {
  data: Record<string, unknown>;
  searchText: string;
}

export function SnapshotTree({ data, searchText }: SnapshotTreeProps) {
  return (
    <div className="text-xs">
      <TreeNode
        keyName="GameSnapshot"
        value={data}
        depth={0}
        searchText={searchText.toLowerCase()}
        defaultOpen
      />
    </div>
  );
}

function TreeNode({
  keyName,
  value,
  depth,
  searchText,
  defaultOpen = false,
}: {
  keyName: string;
  value: unknown;
  depth: number;
  searchText: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || depth < 1);

  const isObject = typeof value === "object" && value !== null;
  const isArray = Array.isArray(value);

  // Check if this node or any descendant matches search
  const matchesSearch =
    searchText === "" ||
    keyName.toLowerCase().includes(searchText) ||
    JSON.stringify(value).toLowerCase().includes(searchText);

  if (!matchesSearch) return null;

  const keyHighlight =
    searchText && keyName.toLowerCase().includes(searchText)
      ? "#fc6"
      : "#7ae";

  if (!isObject) {
    // Leaf node
    const valueStr =
      typeof value === "string"
        ? `"${value}"`
        : value === null
          ? "null"
          : String(value);

    const valueColor =
      typeof value === "string"
        ? "#8c8"
        : typeof value === "number"
          ? "#c8a"
          : typeof value === "boolean"
            ? "#8ac"
            : "#888";

    const valueHighlight =
      searchText && valueStr.toLowerCase().includes(searchText)
        ? "#fc6"
        : valueColor;

    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <span style={{ color: keyHighlight }}>{keyName}</span>
        <span style={{ color: "#555" }}>: </span>
        <span style={{ color: valueHighlight }}>{valueStr}</span>
      </div>
    );
  }

  // Object or array node
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  const bracket = isArray ? ["[", "]"] : ["{", "}"];
  const count = entries.length;

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ cursor: "pointer" }}
      >
        <span style={{ color: "#555", width: 12, display: "inline-block" }}>
          {open ? "▼" : "▶"}
        </span>
        <span style={{ color: keyHighlight }}>{keyName}</span>
        <span style={{ color: "#555" }}>
          {" "}
          {bracket[0]}
          {!open && (
            <span>
              {" "}
              ... {count} {isArray ? "items" : "keys"} {bracket[1]}
            </span>
          )}
        </span>
      </div>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <TreeNode
              key={k}
              keyName={k}
              value={v}
              depth={depth + 1}
              searchText={searchText}
            />
          ))}
          <div style={{ paddingLeft: depth * 16 + 12, color: "#555" }}>
            {bracket[1]}
          </div>
        </>
      )}
    </div>
  );
}
