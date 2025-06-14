// 固定的学科分类
export const CATEGORIES = [
  {
    id: '工科',
    name: '工科',
    englishName: 'Engineering / Technology',
    icon: 'fa-solid fa-gears',
    bgGradient: 'bg-gradient-to-br from-blue-500 to-blue-700'
  },
  {
    id: '文科',
    name: '文科',
    englishName: 'Liberal Arts / Humanities',
    icon: 'fa-solid fa-book-open',
    bgGradient: 'bg-gradient-to-br from-pink-400 to-pink-600'
  },
  {
    id: '商科',
    name: '商科',
    englishName: 'Business / Commerce / Economics',
    icon: 'fa-solid fa-chart-line',
    bgGradient: 'bg-gradient-to-br from-yellow-400 to-yellow-600'
  },
  {
    id: '理科',
    name: '理科',
    englishName: 'Science / Natural Sciences',
    icon: 'fa-solid fa-atom',
    bgGradient: 'bg-gradient-to-br from-green-400 to-green-600'
  }
];

// 获取所有分类ID
export const getCategoryIds = (): string[] => {
  return CATEGORIES.map(category => category.id);
};

// 根据ID获取分类信息
export const getCategoryById = (id: string) => {
  return CATEGORIES.find(category => category.id === id);
}; 