declare module "typography-theme-bootstrap";

interface Window {
  __theme: string;
  __onThemeChange: (theme: string) => void;
  __setPreferredTheme: (theme: string) => void;
}
