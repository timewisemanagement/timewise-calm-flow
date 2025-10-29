import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme('dark');

  return <>{children}</>;
}
