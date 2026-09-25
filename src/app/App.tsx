import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";

const CreateIntentPage = lazy(() => import("../features/intent/CreateIntentPage").then((module) => ({ default: module.CreateIntentPage })));
const EvaluatePage = lazy(() => import("../features/evaluate/EvaluatePage").then((module) => ({ default: module.EvaluatePage })));
const HomePage = lazy(() => import("../features/home/HomePage").then((module) => ({ default: module.HomePage })));
const VerifyPage = lazy(() => import("../features/verify/VerifyPage").then((module) => ({ default: module.VerifyPage })));

export function App() {
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center text-sm text-zinc-500">Loading IntentSeal…</div>}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="create" element={<CreateIntentPage />} />
          <Route path="evaluate" element={<EvaluatePage />} />
          <Route path="verify" element={<VerifyPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
