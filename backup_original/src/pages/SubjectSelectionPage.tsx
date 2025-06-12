import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const SubjectSelectionPage: React.FC = () => {
  const { version } = useParams<{ version: string }>();
  const navigate = useNavigate();

  const handleSubjectSelect = (subject: string) => {
    navigate(`/projects/${version}/${subject}`);
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">选择学科方向</h1>
        <button
          onClick={() => navigate('/')}
          className="text-gray-600 hover:text-gray-800"
        >
          <span className="text-xl">←</span>
        </button>
      </div>
      <div className="flex flex-col gap-6">
        <div
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
          onClick={() => handleSubjectSelect('engineering')}
        >
          <div className="flex items-center">
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-2xl text-white">工</span>
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-bold text-gray-800">工科</h2>
              <p className="text-sm text-gray-500">Engineering / Technology</p>
            </div>
          </div>
        </div>
        <div
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
          onClick={() => handleSubjectSelect('liberal-arts')}
        >
          <div className="flex items-center">
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-2xl text-white">文</span>
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-bold text-gray-800">文科</h2>
              <p className="text-sm text-gray-500">Liberal Arts / Humanities</p>
            </div>
          </div>
        </div>
        <div
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
          onClick={() => handleSubjectSelect('business')}
        >
          <div className="flex items-center">
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-2xl text-white">商</span>
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-bold text-gray-800">商科</h2>
              <p className="text-sm text-gray-500">Business / Commerce / Economics</p>
            </div>
          </div>
        </div>
        <div
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
          onClick={() => handleSubjectSelect('science')}
        >
          <div className="flex items-center">
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-2xl text-white">理</span>
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-bold text-gray-800">理科</h2>
              <p className="text-sm text-gray-500">Science / Natural Sciences</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubjectSelectionPage; 