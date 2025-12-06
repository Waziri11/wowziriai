import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "antd/dist/reset.css";
import "./index.css";
import logoPng from "./assets/images/logo.png";

const ensureFavicon = () => {
  const existing =
    document.querySelector("link[rel='icon']") ??
    document.createElement("link");

  existing.rel = "icon";
  existing.type = "image/png";
  existing.href = logoPng;

  if (!existing.parentElement) {
    document.head.appendChild(existing);
  }
};

ensureFavicon();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

