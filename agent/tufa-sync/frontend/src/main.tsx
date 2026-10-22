import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/dropzone/styles.css";
import "./app.css";
import "dayjs/locale/sq";

import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { colorSchemeManager, theme } from "./theme";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <MantineProvider theme={theme} colorSchemeManager={colorSchemeManager} defaultColorScheme="auto">
      <I18nProvider>
        <App />
      </I18nProvider>
    </MantineProvider>
  </StrictMode>,
);
