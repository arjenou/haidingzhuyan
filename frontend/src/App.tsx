import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import VersionSelectionPage from './pages/VersionSelectionPage';
import SubjectSelectionPage from './pages/SubjectSelectionPage';
import ProjectListPage from './pages/ProjectListPage';
import AdminPage from './pages/AdminPage';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<VersionSelectionPage />} />
        <Route path="/subjects/:version" element={<SubjectSelectionPage />} />
        <Route path="/projects/:version/:subject" element={<ProjectListPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;
