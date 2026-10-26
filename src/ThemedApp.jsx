import { useEffect } from "react";
import { ThemeProvider } from "styled-components";

import App from "./App.jsx";
import useStore from "./store/store.js";
import GlobalStyle from "./theme/GlobalStyle.js";
import THEME from "./theme/Theme.js";

// Same design system as the Trail Suite, light or dark as the store says.
export default function ThemedApp() {
  const variant = useStore((state) => state.theme);
  const theme = { ...THEME, currentVariant: variant };

  useEffect(() => {
    const background = THEME.colors[variant]["--color-background"];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  }, [variant]);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <App />
    </ThemeProvider>
  );
}
