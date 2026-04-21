import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi, type OrgSettings } from '@/api-client/settings.api';

export const useSettingsStore = defineStore('settings', () => {
  const data = ref<OrgSettings | null>(null);
  const loading = ref(false);
  async function fetch() {
    loading.value = true;
    try { data.value = await settingsApi.get(); }
    finally { loading.value = false; }
  }
  async function update(patch: Partial<OrgSettings>) {
    data.value = await settingsApi.update(patch);
  }
  return { data, loading, fetch, update };
});
