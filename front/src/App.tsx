
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" reverseOrder={false} />
      <Router>
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
      </Router>
    </QueryClientProvider>
  );
}

export default App;
