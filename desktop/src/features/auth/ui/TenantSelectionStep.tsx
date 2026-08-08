import { Button } from "@/shared/ui/button";

export function TenantSelectionStep({
  onSelectTenant,
}: {
  onSelectTenant: (tenantId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-xl font-medium">Select Organization</h2>
      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={() => onSelectTenant("org-1")}>
          Acme Corp
        </Button>
        <Button variant="outline" onClick={() => onSelectTenant("org-2")}>
          Globex
        </Button>
      </div>
    </div>
  );
}
