import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function AgentTemplatesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agent Templates</h1>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="border rounded-lg p-12 text-center space-y-3">
        <p className="text-muted-foreground">No templates yet</p>
        <p className="text-sm text-muted-foreground">
          Agent templates are vertical-specific starter configurations (Real Estate Qualifier,
          Insurance Lead Gen, etc.) that staff creates and maps to tenants.
        </p>
      </div>
    </div>
  );
}
