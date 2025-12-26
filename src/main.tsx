import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeOrtRuntime } from "./lib/ort-config";

// Initialize ONNX Runtime early with explicit WASM paths
initializeOrtRuntime();

createRoot(document.getElementById("root")!).render(<App />);

