import { useEffect } from 'react';

export function useTheme(theme?: string) {
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme (light/dark)
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
}
