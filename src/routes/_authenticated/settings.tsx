import { createFileRoute } from "@tanstack/react-router";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import { LoyaltyPanel } from "@/components/LoyaltyPanel";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { setCurrency } from "@/lib/format";
import { toast } from "sonner";

const CURRENCIES = ["KS", "MMK", "THB", "USD", "EUR", "SGD", "CNY", "JPY", "MYR", "VND"];

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <RequireAdmin>
      <SettingsPage />
    </RequireAdmin>
  ),
});

function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { lang, setLang } = useI18n();
  const [s, setS] = useState<any>(null);
  const [profile, setProfile] = useState<any>({ full_name: "", business_name: "" });
  const [pw, setPw] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: prof } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (settings) setS(settings);
  }, [settings]);
  useEffect(() => {
    if (prof)
      setProfile({ full_name: prof.full_name ?? "", business_name: prof.business_name ?? "" });
  }, [prof]);

  const saveSettings = async () => {
    if (!s) return;
    const { id, updated_at, ...payload } = s;
    const { error } = await supabase.from("settings").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity({
      action: "settings.update",
      entityType: "settings",
      entityId: id,
      summary: "Settings updated",
    });
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...profile });
    if (error) return toast.error(error.message);
    await logActivity({
      action: "profile.update",
      entityType: "profile",
      entityId: user.id,
      summary: `Profile updated: ${profile.full_name || user.email}`,
    });
    toast.success("Profile updated");
  };

  const changePassword = async () => {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    await logActivity({ action: "auth.password_change", summary: "Password changed" });
    toast.success("Password changed");
    setPw("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {s && (
            <>
              <div className="space-y-1.5">
                <Label>Logo</Label>
                <ImageUpload
                  value={s.logo_url}
                  onChange={(url) => setS({ ...s, logo_url: url })}
                  bucket="branding"
                  folder="logos"
                  size="md"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Business Name</Label>
                <Input
                  value={s.business_name ?? ""}
                  onChange={(e) => setS({ ...s, business_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select
                  value={CURRENCIES.includes(s.currency) ? s.currency : "__custom"}
                  onValueChange={(v) => {
                    if (v === "__custom") return;
                    setS({ ...s, currency: v });
                    setCurrency(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  placeholder="Custom code (e.g. AUD)"
                  value={s.currency ?? ""}
                  onChange={(e) => {
                    setS({ ...s, currency: e.target.value });
                    setCurrency(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default Waiting Time</Label>
                <Input
                  value={s.default_waiting_time ?? ""}
                  onChange={(e) => setS({ ...s, default_waiting_time: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tax %</Label>
                  <Input
                    type="number"
                    value={s.tax_percent ?? 0}
                    onChange={(e) => setS({ ...s, tax_percent: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Service Fee (KS)</Label>
                  <Input
                    type="number"
                    value={s.service_fee ?? 0}
                    onChange={(e) => setS({ ...s, service_fee: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Display Language</Label>
                <Select
                  value={lang}
                  onValueChange={(v) => {
                    setLang(v as "en" | "mm");
                    setS({ ...s, language: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="mm">မြန်မာ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveSettings}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Business Name</Label>
            <Input
              value={profile.business_name}
              onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
            />
          </div>
          <Button onClick={saveProfile} variant="secondary">
            <Save className="mr-2 h-4 w-4" />
            Update Profile
          </Button>
          <div className="space-y-1.5 border-t pt-4">
            <Label>Change Password</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="New password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <Button onClick={changePassword}>Update</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <LoyaltyPanel />
      </div>
    </div>
  );
}
