import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export { supabase as authSupabase };

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

// Generate a random nonce and its SHA-256 hash (required by Supabase + GIS)
async function generateNonce() {
  const raw = crypto.getRandomValues(new Uint8Array(16));
  const rawStr = Array.from(raw).map(b => String.fromCharCode(b)).join('');
  const nonce = btoa(rawStr);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(nonce));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return { nonce, hashedNonce };
}

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
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) upsertProfile(u);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    setAuthError(null);
    try {
      await waitForGoogle();
      const { nonce, hashedNonce } = await generateNonce();

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        nonce: hashedNonce,
        callback: async ({ credential }) => {
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: credential,
            nonce,
          });
          if (error) {
            console.error('Supabase signInWithIdToken error:', error);
            setAuthError(error.message);
          } else if (data?.user) {
            setUser(data.user);
            await upsertProfile(data.user);
          }
        },
        ux_mode: 'popup',
        use_fedcm_for_prompt: false,
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One Tap suppressed — render a standard button as fallback
          const btn = document.getElementById('g-signin-btn');
          if (btn) {
            window.google.accounts.id.renderButton(btn, {
              theme: 'outline', size: 'large', width: 280,
            });
          }
        }
      });
    } catch (err) {
      console.error('signIn error:', err);
      setAuthError('Sign-in failed. Please try again.');
    }
  };

  const signOut = () => supabase.auth.signOut();

  return { user, loading, authError, signIn, signOut };
}
