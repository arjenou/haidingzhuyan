import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SubjectSelectionPage from './pages/SubjectSelectionPage';
import ProjectListPage from './pages/ProjectListPage';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<SubjectSelectionPage />} />
        <Route path="/projects/:subject" element={<ProjectListPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;
