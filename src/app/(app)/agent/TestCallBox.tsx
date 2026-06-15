"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Phone } from "lucide-react";

export default function TestCallBox() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  async function makeTestCall() {
    setLoading(true);
    const res = await fetch("/api/agent/test-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
    const body = await res.json();
    if (res.ok) {
      toast.success(body.message ?? "Call initiated — your phone will ring shortly");
    } else {
      toast.error(body.error ?? "Failed to place test call");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Test Call
        </CardTitle>
        <CardDescription>
          Enter a phone number and your agent will call it within seconds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label>Phone number</Label>
            <Input
              type="tel"
              placeholder="+91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={makeTestCall}
              disabled={loading || !phoneNumber}
              className="gap-1"
            >
              <Phone className="h-4 w-4" />
              {loading ? "Calling..." : "Call Now"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
