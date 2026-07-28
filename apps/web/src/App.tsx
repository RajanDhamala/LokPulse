
import { Suspense } from "react";
import "./index.css";
import {
  LazyTestPage,
  LazyProvincesPage,
  LazyPartiesPage,
  LazyConstituencyPage,
  LazyMaps,
  LazyNotFoundPage,
} from "./LazyLoading/LazyLoading";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "./Utils/QueryConfig.tsx";
import Loader from "./LazyLoading/Loader.tsx";
import { Toaster } from "react-hot-toast";
import AppMenu from "./Components/AppMenu.tsx";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: "var(--popover)",
            border: "1px solid var(--border)",
            color: "var(--popover-foreground)",
          },
        }}
      />
      <Router>
        <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--color-card)_0%,_transparent_70%)] bg-[length:100%_32rem] bg-no-repeat text-foreground dark:bg-none">
          <AppMenu />
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/popular" replace />} />
              <Route path="/popular" element={<LazyTestPage />} />
              <Route path="/provinces" element={<LazyProvincesPage />} />
              <Route path="/parties" element={<LazyPartiesPage />} />
              <Route path="/constituency" element={<LazyConstituencyPage />} />
              <Route path="/maps" element={<LazyMaps />} />
              <Route path="*" element={<LazyNotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
