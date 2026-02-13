import Preloader from "./preloader";
import { ThemeProvider } from "./theme-provider";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <Preloader>
        {children}
      </Preloader>
    </ThemeProvider>
  );
};
