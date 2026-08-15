"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, LogOut, User } from "lucide-react";
import { useHypers0nic } from "@/store/hypers0nic";
import { syncTinfoil, applyTinfoilPayload } from "@/lib/tinfoil";
import { toast } from "sonner";

export function Tinf0ilAuth({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tinfoil = useHypers0nic((s) => s.settings.tinfoil);
  const disconnectTinfoil = useHypers0nic((s) => s.disconnectTinfoil);
  const setTheme = useHypers0nic((s) => s.setTheme);
  const setTabCloak = useHypers0nic((s) => s.setTabCloak);
  const setSearchEngine = useHypers0nic((s) => s.setSearchEngine);
  const setPreferences = useHypers0nic((s) => s.setPreferences);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Enter a username and password.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {

      const res = await fetch("/api/tinfoil/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          username: username.trim(),
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Auth failed (HTTP ${res.status})`);
      }

      const data = await res.json();

      if (data.profile?.payload) {
        const newSettings = applyTinfoilPayload(
          useHypers0nic.getState().settings,
          data.profile.payload,
          data.profile.username
        );

        useHypers0nic.setState({ settings: newSettings });

        if (data.profile.payload.theme) {
          setTheme(data.profile.payload.theme);
        }
        if (data.profile.payload.tabCloak) {
          setTabCloak(data.profile.payload.tabCloak);
        }
        if (data.profile.payload.searchEngine) {
          setSearchEngine(data.profile.payload.searchEngine);
        }
        if (data.profile.payload.preferences) {
          setPreferences(data.profile.payload.preferences);
        }
      }

      toast.success(
        mode === "login"
          ? `Welcome back, ${data.profile.username}!`
          : `Account created. Welcome, ${data.profile.username}!`
      );

      sessionStorage.setItem("hypers0nic:tinfoil-token", password);
      onOpenChange(false);
      setUsername("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    disconnectTinfoil();
    sessionStorage.removeItem("hypers0nic:tinfoil-token");
    toast.success("Disconnected from Tinf0il.");
  };

  if (tinfoil.connected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" />
              Tinf0il account
            </DialogTitle>
            <DialogDescription className="text-xs">
              Your Tinf0il settings are synced.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 rounded border border-border/30 bg-card/50 px-3 py-2.5">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {tinfoil.username}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tinfoil.syncedAt
                    ? `Synced ${new Date(tinfoil.syncedAt).toLocaleString("en-US")}`
                    : "Connected"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="w-full gap-2"
            >
              <LogOut className="size-4" />
              Disconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            Tinf0il
          </DialogTitle>
          <DialogDescription className="text-xs">
            Login or create an account to sync your tab cloak and theme settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="text-xs">Login</TabsTrigger>
            <TabsTrigger value="signup" className="text-xs">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tinfoil-user" className="text-xs">Username</Label>
              <Input
                id="tinfoil-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="text-sm"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tinfoil-pass" className="text-xs">Password</Label>
              <Input
                id="tinfoil-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-sm"
                autoComplete="current-password"
              />
            </div>
            <Button onClick={handleSubmit} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Login
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tinfoil-signup-user" className="text-xs">Username</Label>
              <Input
                id="tinfoil-signup-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="text-sm"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tinfoil-signup-pass" className="text-xs">Password</Label>
              <Input
                id="tinfoil-signup-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-sm"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tinfoil-signup-confirm" className="text-xs">Confirm password</Label>
              <Input
                id="tinfoil-signup-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="text-sm"
                autoComplete="new-password"
              />
            </div>
            <Button onClick={handleSubmit} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Create account
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
