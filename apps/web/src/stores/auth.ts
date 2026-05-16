import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Lazy-init to avoid erroring in test environments without env
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
    }
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

const isDemoMode = !supabaseUrl || !supabaseKey || supabaseUrl.includes('xxx.supabase.co');

const DEMO_SESSION = {
  access_token: 'demo',
  refresh_token: 'demo',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'demo', email: 'demo@舵手.local', aud: 'demo' },
} as unknown as Session;

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(isDemoMode ? DEMO_SESSION : null);
  const initialized = ref(false);

  async function init() {
    if (initialized.value) return;
    if (isDemoMode) {
      session.value = DEMO_SESSION;
      initialized.value = true;
      return;
    }
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    session.value = data.session;
    supabase.auth.onAuthStateChange((_event, s) => {
      session.value = s;
    });
    initialized.value = true;
  }

  const isAuthed = computed(() => !!session.value);
  const userEmail = computed(() => session.value?.user?.email ?? null);

  async function loginWithEmail(email: string, password: string) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function logout() {
    await getSupabase().auth.signOut();
  }

  function authHeader(): Record<string, string> {
    return session.value ? { Authorization: `Bearer ${session.value.access_token}` } : {};
  }

  return {
    session, initialized, isAuthed, userEmail,
    init, loginWithEmail, signUp, logout, authHeader,
  };
});
