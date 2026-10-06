/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Portfolio from "./pages/Portfolio";
// The six design directions. Only linked from here, so it stays out of the main
// bundle's critical path and can be dropped once a direction is chosen.
const Pitch = lazy(() => import("./pages/Pitch"));

// The admin console pulls in the full Firebase Auth + Firestore write surface.
// It is a separate route that essentially no visitor opens, so it is split out
// of the main bundle rather than shipped to every first-time reader.
const Admin = lazy(() => import("./pages/Admin"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900">
      <p className="label">Loading…</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-900 px-6 text-center">
      <p className="label">404</p>
      <h1 className="text-[clamp(2rem,6vw,3.5rem)] leading-tight text-bone-100">
        This page doesn&apos;t exist.
      </h1>
      <Link
        to="/"
        className="border-b border-brass-400/40 pb-1 font-mono text-sm text-brass-400 transition-colors hover:text-brass-300"
      >
        ← back home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route
          path="/pitch"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Pitch />
            </Suspense>
          }
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Admin />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}