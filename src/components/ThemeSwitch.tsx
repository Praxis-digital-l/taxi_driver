import { useTheme } from "@/theme/theme-provider";
import "./ThemeSwitch.css";

export default function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="theme-switch-wrapper">
      <label htmlFor="switch" className="switch">
        <input 
          id="switch" 
          type="checkbox" 
          checked={theme === 'light'}
          onChange={toggleTheme}
        />
        <span className="slider" />
        <span className="decoration" />
      </label>
    </div>
  );
}
