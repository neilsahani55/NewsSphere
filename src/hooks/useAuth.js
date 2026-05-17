import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export { supabase as authSupabase };

// Upsert profile row whenever a user signs in
async function upsertProfile(u) {
  if (!u) return;
  await supabase.from('profiles').upsert({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || u.email,
    avatar_url: u.user_metadata?.avatar_url || null,
    last_seen: new Date().toISOString(),
  }, { onConflict: 'id' });
}

// Wait for the Google Identity Services script to be ready
function waitForGoogle() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) { resolve(); return; }
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) { clearInterval(interval); resolve(); }
    }, 100);
  });
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setLoading(false);
    });

    // Keep state in sync with Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      upsertProfile(u);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    await waitForGoogle();

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        // Exchange Google ID token with Supabase — no redirect, no Supabase URL shown
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: credential,
        });
        if (error) console.error('Sign-in error:', error.message);
      },
      ux_mode: 'popup',
    });

    window.google.accounts.id.prompt((notification) => {
      // If One Tap is suppressed (e.g. user dismissed it), fall back to popup button
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        window.google.accounts.id.renderButton(
          document.getElementById('g-signin-btn'),
          { theme: 'outline', size: 'large', width: 300 }
        );
      }
    });
  };

  const signOut = () => supabase.auth.signOut();

  return { user, loading, signIn, signOut };
}
