import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../constants/categories';

const SubjectSelectionPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSubjectSelect = (category: string) => {
    navigate(`/projects/${category}`);
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">选择学科方向</h1>
      </div>
      <div className="flex flex-col gap-6">
        {CATEGORIES.map(category => (
          <div
            key={category.id}
            className="bg-white rounded-xl shadow-lg p-6 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
            onClick={() => handleSubjectSelect(category.id)}
          >
            <div className="flex items-center">
              <div 
                className="w-16 h-16 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: category.bgColor }}
              >
                <span className="text-2xl">{category.icon}</span>
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-bold text-gray-800">{category.name}</h2>
                <p className="text-sm text-gray-500">{category.englishName}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubjectSelectionPage; 