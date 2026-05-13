import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getTheme, setTheme, onThemeChange, resolveTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [t, setT] = useState<Theme>("system");
  useEffect(() => {
    setT(getTheme());
    const off = onThemeChange(() => setT(getTheme()));
    return () => { off(); };
  }, []);
  const resolved = resolveTheme(t);
  const Icon = resolved === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}><Sun className="mr-2 h-4 w-4" />Light{t === "light" && " ✓"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}><Moon className="mr-2 h-4 w-4" />Dark{t === "dark" && " ✓"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}><Monitor className="mr-2 h-4 w-4" />System{t === "system" && " ✓"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
