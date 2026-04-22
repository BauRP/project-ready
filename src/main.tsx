import { createRoot } from "react-dom/client";
import { initProductionMode } from "./lib/log";
import App from "./App.tsx";
import "./index.css";

initProductionMode();

createRoot(document.getElementById("root")!).render(<App />);
