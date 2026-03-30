interface EmptyStateProps {
  message: string;
  detail?: string;
}

export function EmptyState({ message, detail }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
      <div className="text-sm" style={{ color: "#888" }}>
        {message}
      </div>
      {detail && (
        <div className="text-xs mt-2" style={{ color: "#666" }}>
          {detail}
        </div>
      )}
    </div>
  );
}
