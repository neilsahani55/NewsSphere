import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export { supabase as authSupabase };

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      // Upsert profile row on login
      if (u) {
        supabase.from('profiles').upsert({
          id: u.id,
          email: u.email,
          name: u.user_metadata?.full_name || u.email,
          avatar_url: u.user_metadata?.avatar_url || null,
          last_seen: new Date().toISOString(),
        }, { onConflict: 'id' }).then(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });

  const signOut = () => supabase.auth.signOut();

  return { user, loading, signIn, signOut };
}
