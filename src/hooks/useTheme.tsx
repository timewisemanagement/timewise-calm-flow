import { useEffect } from 'react';

export function useTheme(theme: string) {
  useEffect(() => {
    // Always apply dark mode
    document.documentElement.classList.add('dark');
  }, []);
}
