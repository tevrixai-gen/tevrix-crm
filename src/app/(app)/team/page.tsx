"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Shield, Trash2, Mail } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string; image?: string | null };
}

interface Invitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string;
}

function RoleBadge({ role }: { role: string }) {
  const color =
    role === "owner"
      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      : role === "admin"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      : "bg-muted text-muted-foreground";
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{role}</span>;
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const org = await authClient.organization.getFullOrganization();
      if (!org.data) return;
      setOrgId(org.data.id);
      setMembers(
        (org.data.members ?? []).map((m: Record<string, unknown>) => ({
          id: m.id as string,
          role: m.role as string,
          createdAt: m.createdAt as string,
          user: m.user as Member["user"],
        }))
      );
      setInvitations(
        ((org.data.invitations ?? []) as Record<string, unknown>[])
          .filter((inv) => inv.status === "pending")
          .map((inv) => ({
            id: inv.id as string,
            email: inv.email as string,
            role: inv.role as string | null,
            status: inv.status as string,
            expiresAt: inv.expiresAt as string,
          }))
      );
    } catch {
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    setInviting(true);
    try {
      const res = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        organizationId: orgId,
      });
      if (res.error) {
        toast.error(res.error.message ?? "Failed to send invitation");
      } else {
        toast.success(`Invitation sent to ${inviteEmail.trim()}`);
        setInviteEmail("");
        await loadData();
      }
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    try {
      await authClient.organization.cancelInvitation({ invitationId });
      toast.success("Invitation cancelled");
      await loadData();
    } catch {
      toast.error("Failed to cancel invitation");
    }
  };

  const handleRemoveMember = async (memberIdToRemove: string) => {
    if (!orgId) return;
    try {
      await authClient.organization.removeMember({
        memberIdOrEmail: memberIdToRemove,
        organizationId: orgId,
      });
      toast.success("Member removed");
      await loadData();
    } catch {
      toast.error("Failed to remove member");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold">Team</h1>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Team</h1>
      </div>

      {/* Invite section */}
      <div className="border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Invite a team member
        </h2>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? "Sending..." : "Invite"}
          </Button>
        </div>
      </div>

      {/* Members */}
      <div className="border rounded-lg divide-y mb-6">
        <div className="px-4 py-2 bg-muted/50">
          <h2 className="text-sm font-semibold">Members ({members.length})</h2>
        </div>
        {members.map((m) => (
          <div key={m.id} className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {m.user.name?.charAt(0).toUpperCase() ?? "?"}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{m.user.name}</p>
                <p className="text-xs text-muted-foreground">{m.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RoleBadge role={m.role} />
              {m.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveMember(m.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="border rounded-lg divide-y">
          <div className="px-4 py-2 bg-muted/50">
            <h2 className="text-sm font-semibold">Pending Invitations ({invitations.length})</h2>
          </div>
          {invitations.map((inv) => (
            <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={inv.role ?? "member"} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => handleCancelInvite(inv.id)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Roles</p>
            <ul className="space-y-0.5">
              <li><strong>Owner</strong> — Full access, billing, can delete the organization</li>
              <li><strong>Admin</strong> — Manage team members, campaigns, and settings</li>
              <li><strong>Member</strong> — View campaigns, calls, and leads</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
