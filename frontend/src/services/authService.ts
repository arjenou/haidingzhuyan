// 简单的认证服务，用于管理后台

// 管理员密码 - 实际应用中应该使用更安全的方法
const ADMIN_PASSWORD = 'admin123'; // 应当修改为更复杂的密码
const AUTH_TOKEN_KEY = 'xinhangdao_admin_token';

/**
 * 管理员登录
 * @param password 管理员密码
 * @returns 是否登录成功
 */
export const login = (password: string): boolean => {
  if (password === ADMIN_PASSWORD) {
    // 简单实现，使用时间戳作为令牌
    const token = `token_${Date.now()}`;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return true;
  }
  return false;
};

/**
 * 退出登录
 */
export const logout = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

/**
 * 检查是否已登录
 * @returns 是否已登录
 */
export const isLoggedIn = (): boolean => {
  return !!localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * 获取认证令牌
 * @returns 认证令牌
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}; 