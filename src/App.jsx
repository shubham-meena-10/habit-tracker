// import { Fragment, useContext } from "react";
// import { ThemeContext } from "./helpers/context/ThemeContext";
// import { ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
// import "sweetalert2/src/sweetalert2.scss";
// import "./assets/styles/app.css";
// import RootRouter from "./auth/routes/RootRouter";

// const App = () => {
//   const { mode } = useContext(ThemeContext);

//   return (
//     <Fragment>
//       <ToastContainer
//         autoClose={3000}
//         theme={mode}
//         draggable={true}
//         newestOnTop={true}
//         toastClassName="toast-custom"
//       />
//       <RootRouter />
//     </Fragment>
//   );
// };

// export default App;

// const App = () => {
//   return (
//     <div>App hello</div>
//   )
// }

// export default App

// import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
// import Layout from './components/common/Layout';
// import HomePage from './pages/HomePage';
// import HabitsPage from './pages/HabitsPage';
// import ProgressPage from './pages/ProgressPage';
// import CalendarPage from './pages/CalendarPage';
// import SettingsPage from './pages/SettingsPage';

// export default function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route element={<Layout />}>
//           <Route index element={<HomePage />} />
//           <Route path="habits" element={<HabitsPage />} />
//           <Route path="progress" element={<ProgressPage />} />
//           <Route path="calendar" element={<CalendarPage />} />
//           <Route path="settings" element={<SettingsPage />} />
//           <Route path="*" element={<Navigate to="/" replace />} />
//         </Route>
//       </Routes>
//     </BrowserRouter>
//   );
// }

import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AppProvider } from "./store/AppContext";
import Layout from "./components/common/Layout";
import HomePage from "./pages/HomePage";
import HabitsPage from "./pages/HabitsPage";
import ProgressPage from "./pages/ProgressPage";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";
import HabitEditPage from "./pages/HabitEditPage";
import TimerPage from "./pages/TimerPage";
import QuantityPage from "./pages/QuantityPage";
import HabitDetailPage from "./pages/HabitDetailPage";
import CheckinPage from "./pages/CheckinPage";
import SchedulePage from "./pages/SchedulePage";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="habits/new" element={<HabitEditPage />} />
            <Route path="habits/:habitId" element={<HabitDetailPage />} />
            <Route path="habits/:habitId/edit" element={<HabitEditPage />} />
            <Route path="timer/:habitId" element={<TimerPage />} />
            <Route path="quantity/:habitId" element={<QuantityPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="checkin" element={<CheckinPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
