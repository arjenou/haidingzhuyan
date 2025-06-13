// 固定的学科分类
export const CATEGORIES = [
  {
    id: '工科',
    name: '工科',
    englishName: 'Engineering / Technology',
    icon: '工',
    bgColor: '#2D3748'
  },
  {
    id: '文科',
    name: '文科',
    englishName: 'Liberal Arts / Humanities',
    icon: '文',
    bgColor: '#2D3748'
  },
  {
    id: '商科',
    name: '商科',
    englishName: 'Business / Commerce / Economics',
    icon: '商',
    bgColor: '#2D3748'
  },
  {
    id: '理科',
    name: '理科',
    englishName: 'Science / Natural Sciences',
    icon: '理',
    bgColor: '#2D3748'
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