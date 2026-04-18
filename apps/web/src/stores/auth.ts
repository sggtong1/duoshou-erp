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

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null);
  const initialized = ref(false);

  async function init() {
    if (initialized.value) return;
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
