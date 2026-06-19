"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Phone,
  Headphones,
  BarChart3,
  Bot,
  BookOpen,
  UsersRound,
  ScrollText,
  Settings,
  Search,
  ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  type: "page" | "lead" | "campaign";
}

const PAGES: SearchResult[] = [
  { id: "p-dashboard", label: "Dashboard", href: "/dashboard", type: "page" },
  { id: "p-leads", label: "Leads", href: "/leads", type: "page" },
  { id: "p-campaigns", label: "Campaigns", href: "/campaigns", type: "page" },
  { id: "p-conversations", label: "Conversations", href: "/calls", type: "page" },
  { id: "p-recordings", label: "Recordings", href: "/recordings", type: "page" },
  { id: "p-analytics", label: "Analytics", href: "/analytics", type: "page" },
  { id: "p-agent", label: "Your Agent", href: "/agent", type: "page" },
  { id: "p-knowledge", label: "Knowledge Base", href: "/knowledge", type: "page" },
  { id: "p-team", label: "Team", href: "/team", type: "page" },
  { id: "p-activity", label: "Activity Log", href: "/activity-log", type: "page" },
  { id: "p-settings", label: "Settings", href: "/settings", type: "page" },
  { id: "p-new-campaign", label: "New Campaign", sublabel: "Create a new campaign", href: "/campaigns/new", type: "page" },
  { id: "p-import", label: "Import Leads", sublabel: "Upload a CSV file", href: "/leads/import", type: "page" },
];

const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/leads": Users,
  "/campaigns": Megaphone,
  "/calls": Phone,
  "/recordings": Headphones,
  "/analytics": BarChart3,
  "/agent": Bot,
  "/knowledge": BookOpen,
  "/team": UsersRound,
  "/activity-log": ScrollText,
  "/settings": Settings,
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>(PAGES);
  const [selected, setSelected] = useState(0);
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchApi = useCallback(async (q: string) => {
    if (q.length < 2) { setApiResults([]); return; }
    try {
      const [leadsRes, campaignsRes] = await Promise.all([
        fetch(`/api/leads?search=${encodeURIComponent(q)}&limit=5`),
        fetch(`/api/campaigns`),
      ]);
      const items: SearchResult[] = [];
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        for (const l of data.leads ?? []) {
          items.push({
            id: `lead-${l.id}`,
            label: l.name || l.phone,
            sublabel: l.name ? l.phone : undefined,
            href: `/leads/${l.id}`,
            type: "lead",
          });
        }
      }
      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        for (const c of data.campaigns ?? []) {
          if (c.name.toLowerCase().includes(q.toLowerCase())) {
            items.push({
              id: `campaign-${c.id}`,
              label: c.name,
              sublabel: c.status,
              href: `/campaigns/${c.id}`,
              type: "campaign",
            });
          }
        }
      }
      setApiResults(items);
    } catch {
      setApiResults([]);
    }
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    const pageMatches = q
      ? PAGES.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            (p.sublabel?.toLowerCase().includes(q) ?? false)
        )
      : PAGES;
    setResults([...pageMatches, ...apiResults]);
    setSelected(0);
  }, [query, apiResults]);

  useEffect(() => {
    const t = setTimeout(() => searchApi(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query, searchApi]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      navigate(results[selected].href);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, leads, campaigns..."
            className="border-0 focus-visible:ring-0 shadow-none h-11"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
            Esc
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">
              No results found.
            </p>
          )}
          {results.map((r, i) => {
            const Icon = ICON_MAP[r.href] ?? (r.type === "lead" ? Users : r.type === "campaign" ? Megaphone : ArrowRight);
            return (
              <button
                key={r.id}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                  i === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                }`}
                onClick={() => navigate(r.href)}
                onMouseEnter={() => setSelected(i)}
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">
                  {r.label}
                  {r.sublabel && (
                    <span className="ml-2 text-muted-foreground text-xs">{r.sublabel}</span>
                  )}
                </span>
                {r.type !== "page" && (
                  <span className="text-xs text-muted-foreground capitalize">{r.type}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="border-t px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="font-mono bg-muted px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-muted px-1 rounded">↵</kbd> open</span>
          <span><kbd className="font-mono bg-muted px-1 rounded">esc</kbd> close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
