// Phase 8 — PWA polish: install prompt, offline indicator, update-available toast.
// Mount once in the auth layout; no changes to existing PWA registration.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, WifiOff, X } from "lucide-react";
import { toast } from "sonner";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

export function PWAStatus() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 3600 * 1000) return;
      setDeferred(e as BIPEvent);
      setShowInstall(true);
    };
    const onOnline = () => setOffline(false);
    const onOffline = () => {
      setOffline(true);
      toast.warning("You are offline", { description: "Some features may be unavailable." });
    };
    const onInstalled = () => {
      setShowInstall(false);
      toast.success("App installed");
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("appinstalled", onInstalled);

    // SW update notification
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              toast("A new version is available", {
                action: { label: "Reload", onClick: () => window.location.reload() },
                duration: 10000,
              });
            }
          });
        });
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShowInstall(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowInstall(false);
  };

  return (
    <>
      {offline && (
        <div className="fixed top-2 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur">
          <WifiOff className="h-3 w-3" /> Offline
        </div>
      )}
      {showInstall && deferred && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-lg border bg-background p-3 shadow-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Download className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Install My Case</p>
            <p className="text-xs text-muted-foreground">Faster access, works offline.</p>
          </div>
          <Button size="sm" onClick={handleInstall}>Install</Button>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
