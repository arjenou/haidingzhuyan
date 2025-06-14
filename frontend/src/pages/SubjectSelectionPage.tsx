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
            className="bg-white rounded-2xl shadow-xl p-6 cursor-pointer transform transition-transform hover:scale-105 active:scale-95 group"
            onClick={() => handleSubjectSelect(category.id)}
          >
            <div className="flex items-center">
              <div 
                className={`w-16 h-16 rounded-xl flex items-center justify-center text-white text-3xl shadow-md transition-all duration-300 group-hover:scale-110 ${category.bgGradient}`}
              >
                <i className={category.icon}></i>
              </div>
              <div className="ml-6">
                <h2 className="text-xl font-extrabold text-gray-800 mb-1">{category.name}</h2>
                <p className="text-base text-gray-500 font-medium">{category.englishName}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubjectSelectionPage; 