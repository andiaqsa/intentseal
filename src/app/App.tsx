import { Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { CreateIntentPage } from "../features/intent/CreateIntentPage";
import { HomePage } from "../features/home/HomePage";
import { VerifyPage } from "../features/verify/VerifyPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="create" element={<CreateIntentPage />} />
        <Route path="verify" element={<VerifyPage />} />
      </Route>
    </Routes>
  );
}
