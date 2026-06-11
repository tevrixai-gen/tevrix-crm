import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md text-center px-4 space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-5">
            <Clock className="h-10 w-10 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Account under review</h1>
          <p className="text-muted-foreground mt-2">
            Our team is reviewing your account. This usually takes less than 24 hours.
            We will email you as soon as you are approved.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Questions?{" "}
          <a href="mailto:support@tevrixai.com" className="text-foreground hover:underline">
            support@tevrixai.com
          </a>
        </div>
        <Link href="/login">
          <Button variant="outline" size="sm">Back to login</Button>
        </Link>
      </div>
    </div>
  );
}
