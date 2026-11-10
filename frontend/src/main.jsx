import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import { CustomerStorefront } from "./pages/CustomerStorefront.jsx";
import { ProductProvider } from "./contexts/ProductContext.jsx";
import { ShiftProvider } from "./contexts/ShiftContext.jsx";
import { UserProvider } from "./contexts/UserContext.jsx";
import { SettingsProvider } from "./contexts/SettingsContext.jsx";
import { ModalProvider } from "./contexts/ModalContext.jsx";
import { ThemeProvider } from "next-themes";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <BrowserRouter>
      <UserProvider>
        <Routes>
          {/* Public customer routes - no login needed */}
          <Route path="/shop" element={<CustomerStorefront />} />
          <Route path="/shop/:shopId" element={<CustomerStorefront />} />

          {/* Admin routes - all wrapped with auth providers */}
          <Route path="/*" element={
            <SettingsProvider>
              <ModalProvider>
                <ProductProvider>
                  <ShiftProvider>
                    <App />
                  </ShiftProvider>
                </ProductProvider>
              </ModalProvider>
            </SettingsProvider>
          } />
        </Routes>
      </UserProvider>
    </BrowserRouter>
  </ThemeProvider>
);
