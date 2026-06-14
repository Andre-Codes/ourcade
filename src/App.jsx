import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./components/Home.jsx";
import GamePage from "./components/GamePage.jsx";

const QuizPage = lazy(() => import("./components/QuizPage.jsx"));
const FlashPage = lazy(() => import("./components/FlashPage.jsx"));
const StumblePage = lazy(() => import("./components/StumblePage.jsx"));
const AccountPage = lazy(() => import("./components/AccountPage.jsx"));
const ScoresPage = lazy(() => import("./components/ScoresPage.jsx"));
const ProfilePage = lazy(() => import("./components/ProfilePage.jsx"));
const PhonePage = lazy(() => import("./components/PhonePage.jsx"));

function Loading() {
  return <div className="arcade-loading">Loading…</div>;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play/:id" element={<GamePage />} />
        <Route path="/quiz/:id" element={<QuizPage />} />
        <Route path="/flash" element={<FlashPage />} />
        <Route path="/stumble" element={<StumblePage />} />
        <Route path="/me" element={<AccountPage />} />
        <Route path="/phone" element={<PhonePage />} />
        <Route path="/scores/:gameId" element={<ScoresPage />} />
        <Route path="/u/:username" element={<ProfilePage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Suspense>
  );
}
