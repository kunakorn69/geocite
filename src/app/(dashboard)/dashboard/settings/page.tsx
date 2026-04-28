"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getUserDoc, updateUserDoc } from "@/lib/firestore/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UserDoc } from "@/types";

export default function SettingsPage() {
  const { user } = useAuth();
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserDoc(user.uid).then((doc) => {
      if (doc) {
        setUserDoc(doc);
        setDisplayName(doc.displayName ?? "");
      }
    });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateUserDoc(user.uid, { displayName });
      setUserDoc((prev) => prev ? { ...prev, displayName } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const statusColor: Record<string, string> = {
    active: "default",
    trialing: "secondary",
    past_due: "destructive",
    canceled: "outline",
    inactive: "outline",
  };

  const subscriptionStatus = userDoc?.subscriptionStatus ?? "inactive";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account and subscription.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              {saved && <p className="text-sm text-muted-foreground">Saved!</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Your current plan and billing status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status</span>
            <Badge variant={statusColor[subscriptionStatus] as "default" | "secondary" | "destructive" | "outline" ?? "outline"}>
              {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
            </Badge>
          </div>
          {subscriptionStatus !== "active" && (
            <p className="text-sm text-muted-foreground">
              You are on the Free plan.{" "}
              <a href="/#pricing" className="text-primary underline">
                Upgrade to Pro
              </a>{" "}
              for unlimited posts.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
