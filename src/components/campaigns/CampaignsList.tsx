"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalLeads: number;
  calledLeads: number;
  connectedLeads: number;
  qualifiedLeads: number;
  createdAt: string;
  launchedAt: string | null;
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default",
  paused: "outline",
  cancelled: "destructive",
  completed: "secondary",
  draft: "secondary",
};

export default function CampaignsList() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await fetch("/api/campaigns");
      if (res.ok && active) {
        const data = await res.json();
        setRows(data.campaigns);
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 10_000); // live counters
    return () => { active = false; clearInterval(t); };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} total</p>
        </div>
        <Link href="/campaigns/new">
          <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> New Campaign</Button>
        </Link>
      </div>

      {!loading && rows.length === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="text-muted-foreground">No campaigns yet</p>
          <p className="text-sm text-muted-foreground">
            Import leads first, then create a campaign and your agent starts calling.
          </p>
          <Link href="/campaigns/new">
            <Button size="sm" variant="outline">Create your first campaign</Button>
          </Link>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Progress</th>
                <th className="text-left px-4 py-3 font-medium">Qualified</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/campaigns/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[c.status] ?? "secondary"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.calledLeads}/{c.totalLeads} called
                  </td>
                  <td className="px-4 py-3">{c.qualifiedLeads}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
