import { useEffect } from 'react';

export function useTheme(theme?: string, colorScheme?: string) {
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme (light/dark)
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Apply color scheme by updating CSS variables
    if (colorScheme) {
      root.setAttribute('data-color-scheme', colorScheme);
      
      // Update primary colors based on scheme
      const schemes = {
        green: { primary: '142 76% 45%', accent: '142 76% 55%' },
        blue: { primary: '217 91% 60%', accent: '221 83% 65%' },
        purple: { primary: '271 91% 65%', accent: '280 87% 70%' },
        orange: { primary: '25 95% 53%', accent: '33 100% 60%' },
      };
      
      const colors = schemes[colorScheme as keyof typeof schemes] || schemes.green;
      root.style.setProperty('--primary', colors.primary);
      root.style.setProperty('--accent', colors.accent);
    }
  }, [theme, colorScheme]);
}
