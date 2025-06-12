import React from 'react';
import { useNavigate } from 'react-router-dom';

const VersionSelectionPage: React.FC = () => {
  const navigate = useNavigate();

  const handleVersionSelect = (version: string) => {
    navigate(`/subjects/${version}`);
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">选择版本</h1>
      <div className="flex flex-col gap-6">
        <div
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
          onClick={() => handleVersionSelect('pro')}
        >
          <div className="flex items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl text-blue-600">👑</span>
            </div>
            <div className="ml-4 flex-1">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Pro 版学科方向</h2>
              <p className="text-sm text-gray-600">专业版本，提供更多高级功能和资源</p>
            </div>
            <span className="text-gray-400">→</span>
          </div>
        </div>
        <div
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
          onClick={() => handleVersionSelect('normal')}
        >
          <div className="flex items-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl text-green-600">📚</span>
            </div>
            <div className="ml-4 flex-1">
              <h2 className="text-xl font-bold text-gray-800 mb-1">普通版学科方向</h2>
              <p className="text-sm text-gray-600">基础版本，满足常规学习需求</p>
            </div>
            <span className="text-gray-400">→</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionSelectionPage; 