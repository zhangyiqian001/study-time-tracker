import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import TasksPage from './pages/TasksPage/TasksPage';
import TimerPage from './pages/TimerPage/TimerPage';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="timer" element={<TimerPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
