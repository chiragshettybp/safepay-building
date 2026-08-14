import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { UIProvider } from "./components/feedback/UIProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <UIProvider>
    <App />
  </UIProvider>,
);
