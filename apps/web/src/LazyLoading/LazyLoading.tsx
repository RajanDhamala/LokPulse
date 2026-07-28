
import { lazy } from "react";

export const LazyTestPage = lazy(() => import("../Pages/Testpage.tsx"));
export const LazyProvincesPage = lazy(() => import("../Pages/ProvincesPage.tsx"));
export const LazyPartiesPage = lazy(() => import("../Pages/PartiesPage.tsx"));
export const LazyConstituencyPage = lazy(() => import("../Pages/ConstituencyPage.tsx"));
export const LazyMaps = lazy(() => import("../Pages/MapsPage.tsx"));
export const LazyNotFoundPage = lazy(() => import("../Pages/NotFoundPage.tsx"));
