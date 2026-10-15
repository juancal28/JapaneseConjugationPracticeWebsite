import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Typography from "typography";
import bootstrapThemeModule from "typography-theme-bootstrap";
import "./styles/global.css";
import PracticePage from "./practice/PracticePage";
import DeckManager from "./decks/DeckManager";

// Same typography setup as the original quiz_master.js. The package is CommonJS, so unwrap `default`.
const bootstrapTheme = bootstrapThemeModule.default ?? bootstrapThemeModule;
bootstrapTheme.headerFontFamily = ["Open Sans", "sans-serif"];
bootstrapTheme.bodyFontFamily = ["Open Sans", "sans-serif"];
bootstrapTheme.includeNormalize = false;
bootstrapTheme.overrideThemeStyles = () => ({ body: { margin: 0 } });
new Typography(bootstrapTheme).injectStyles();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PracticePage />} />
        <Route path="/decks" element={<DeckManager />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
