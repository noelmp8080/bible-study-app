import { lazy, Suspense } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router";
import AuthProvider from "./AuthProvider.jsx";
import StoreGate from "./StoreGate.jsx";
import ToastProvider from "../components/Toasts.jsx";
import AppShell from "../components/AppShell.jsx";
import { useAuth } from "../hooks/useAuth.js";
import SignIn from "../features/auth/SignIn.jsx";
import TodayScreen from "../features/today/TodayScreen.jsx";
import ReaderScreen, { ReadRedirect } from "../features/reader/ReaderScreen.jsx";
import NotesScreen from "../features/notes/NotesScreen.jsx";
import AskScreen from "../features/ask/AskScreen.jsx";
import SearchScreen from "../features/search/SearchScreen.jsx";
import SettingsScreen from "../features/settings/SettingsScreen.jsx";

// Screens outside the five main tabs load on demand.
const NoteEditor = lazy(() => import("../features/notes/NoteEditor.jsx"));
const PlansScreen = lazy(() => import("../features/plans/PlansScreen.jsx"));
const BibleMapScreen = lazy(() => import("../features/map/BibleMapScreen.jsx"));
const MemoryScreen = lazy(() => import("../features/memory/MemoryScreen.jsx"));
const ThreadsScreen = lazy(() => import("../features/threads/ThreadsScreen.jsx"));
const ThreadDetail = lazy(() => import("../features/threads/ThreadDetail.jsx"));
const FamilyScreen = lazy(() => import("../features/family/FamilyScreen.jsx"));
const SermonList = lazy(() => import("../features/sermon/SermonList.jsx"));
const SermonScreen = lazy(() => import("../features/sermon/SermonScreen.jsx"));
const CardStudio = lazy(() => import("../features/cards/CardStudio.jsx"));

const Splash = () => <div className="splash" role="status" aria-label="Loading">B.</div>;

function Gate() {
  const auth = useAuth();
  if (auth.loading) return <Splash />;
  if (!auth.user && !auth.local) return <SignIn />;
  return (
    <StoreGate userId={auth.user?.id || "local"} remote={!!auth.session}>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<TodayScreen />} />
            <Route path="read" element={<ReadRedirect />} />
            <Route path="read/:book/:chapter/:verse?" element={<ReaderScreen />} />
            <Route path="notes" element={<NotesScreen />} />
            <Route path="notes/:id" element={<NoteEditor />} />
            <Route path="ask" element={<AskScreen />} />
            <Route path="search" element={<SearchScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="plans" element={<PlansScreen />} />
            <Route path="bible" element={<BibleMapScreen />} />
            <Route path="memory" element={<MemoryScreen />} />
            <Route path="threads" element={<ThreadsScreen />} />
            <Route path="threads/:id" element={<ThreadDetail />} />
            <Route path="family" element={<FamilyScreen />} />
            <Route path="sermon" element={<SermonList />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          {/* Full-screen tools without the tab bar */}
          <Route path="sermon/:id" element={<SermonScreen />} />
          <Route path="card" element={<CardStudio />} />
        </Routes>
      </Suspense>
    </StoreGate>
  );
}

// Opened straight from disk (file://) only hash routes work; everywhere else use real URLs.
const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

export default function Root() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
