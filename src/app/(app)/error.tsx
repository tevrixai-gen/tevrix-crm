"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error-boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        An unexpected error occurred. Try again, or contact support if this keeps happening.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">Error ID: {error.digest}</p>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
