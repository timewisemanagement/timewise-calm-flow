import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('light');
  const [colorScheme, setColorScheme] = useState('green');

  useEffect(() => {
    // Load theme from profile
    const loadTheme = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('theme, color_scheme')
          .eq('id', user.id)
          .single();

        if (profile) {
          setTheme(profile.theme || 'light');
          setColorScheme(profile.color_scheme || 'green');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    loadTheme();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadTheme();
    });

    return () => subscription.unsubscribe();
  }, []);

  useTheme(theme, colorScheme);

  return <>{children}</>;
}
