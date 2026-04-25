import { Button } from "@/components/ui/button";

interface Props {
  onYield: () => void;
  disabled: boolean;
}

export function YieldButton({ onYield, disabled }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => { if (!disabled) onYield(); }}
      disabled={disabled}
      title="Step out of the fight on your terms. Edge refreshes by 1 + statuses taken."
    >
      Yield
    </Button>
  );
}
