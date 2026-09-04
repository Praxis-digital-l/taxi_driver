import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/theme/theme-provider";

export default function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative inline-flex items-center">
      <Switch
        checked={theme === "light"}
        onCheckedChange={toggleTheme}
        aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      />
      <Sun className="pointer-events-none absolute right-0.5 h-3.5 w-3.5 text-white transition-opacity" />
      <Moon className="pointer-events-none absolute left-0.5 h-3.5 w-3.5 text-white transition-opacity" />
    </div>
  );
}
