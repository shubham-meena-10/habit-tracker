import { lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider } from './store/AppContext';
import Layout from './components/common/Layout';
import ErrorBoundary from './components/common/ErrorBoundary';
import HomePage from './pages/HomePage';
import HabitsPage from './pages/HabitsPage';

const HabitEditPage = lazy(() => import('./pages/HabitEditPage'));
const HabitDetailPage = lazy(() => import('./pages/HabitDetailPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TimerPage = lazy(() => import('./pages/TimerPage'));
const QuantityPage = lazy(() => import('./pages/QuantityPage'));
const CheckinPage = lazy(() => import('./pages/CheckinPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="habits" element={<HabitsPage />} />
              <Route path="habits/new" element={<HabitEditPage />} />
              <Route path="habits/:habitId" element={<HabitDetailPage />} />
              <Route path="habits/:habitId/edit" element={<HabitEditPage />} />
              <Route path="progress" element={<ProgressPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="timer/:habitId" element={<TimerPage />} />
              <Route path="quantity/:habitId" element={<QuantityPage />} />
              <Route path="checkin" element={<CheckinPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}