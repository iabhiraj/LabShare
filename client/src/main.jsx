import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      gutter={10}
      toastOptions={{
        duration: 3000,
        style: {
          background: "#0f1a2e",
          color: "#e2e8f0",
          border: "1px solid #1e2a42",
          borderRadius: "12px",
          fontSize: "13px",
          fontFamily: "'DM Sans', sans-serif",
        },
        success: { iconTheme: { primary: "#10b981", secondary: "#0f1a2e" } },
        error:   { iconTheme: { primary: "#f87171", secondary: "#0f1a2e" } },
      }}
    />
  </React.StrictMode>
);
