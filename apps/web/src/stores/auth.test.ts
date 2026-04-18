import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './auth';

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initial state is unauthenticated', () => {
    const auth = useAuthStore();
    expect(auth.isAuthed).toBe(false);
    expect(auth.userEmail).toBe(null);
  });

  it('authHeader returns empty object when not authed', () => {
    const auth = useAuthStore();
    expect(auth.authHeader()).toEqual({});
  });
});
