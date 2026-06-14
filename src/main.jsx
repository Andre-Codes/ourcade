import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import AuthProvider from "./lib/AuthProvider.jsx";
import PhoneProvider from "./lib/PhoneProvider.jsx";
import "./arcade.css";

// PhoneProvider sits INSIDE HashRouter (its chrome renders <Link>/useLocation)
// and INSIDE AuthProvider (it reads useAuth), but ABOVE <Routes> so its live
// message listeners run app-wide and never re-mount per route.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <HashRouter>
        <PhoneProvider>
          <App />
        </PhoneProvider>
      </HashRouter>
    </AuthProvider>
  </React.StrictMode>
);
