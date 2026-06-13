import { Button } from "@/components/ui/button";
import { Plus, LayoutTemplate } from "lucide-react";

export default function AgentTemplatesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agent Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Starter configurations for tenant onboarding</p>
        </div>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="border rounded-lg p-16 text-center shadow-sm">
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <LayoutTemplate className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Agent templates are vertical-specific starter configurations (Real Estate Qualifier,
              Insurance Lead Gen, etc.) that staff creates and maps to tenants.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
