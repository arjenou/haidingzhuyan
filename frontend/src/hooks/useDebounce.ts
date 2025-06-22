import { useState, useEffect } from 'react';

/**
 * 一个自定义Hook，用于对值进行防抖处理。
 * @param value 需要防抖的值
 * @param delay 防抖延迟时间（毫秒）
 * @returns 返回经过防抖处理的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  // 创建一个state来存储防抖后的值
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(
    () => {
      // 设置一个定时器，在延迟时间后更新值
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      // 清理函数：在下一次effect执行前或者组件卸载时，清除上一个定时器
      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay] // 仅在value或delay变化时重新设置定时器
  );

  return debouncedValue;
} 