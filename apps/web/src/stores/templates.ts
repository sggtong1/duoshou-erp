import { defineStore } from 'pinia';
import { ref } from 'vue';
import { templatesApi, type ProductTemplate, type CreateTemplateInput } from '@/api-client/templates.api';

export const useTemplatesStore = defineStore('templates', () => {
  const items = ref<ProductTemplate[]>([]);
  const loading = ref(false);
  async function fetchAll() {
    loading.value = true;
    try { items.value = await templatesApi.list(); }
    finally { loading.value = false; }
  }
  async function create(input: CreateTemplateInput) {
    const t = await templatesApi.create(input);
    items.value.unshift(t);
    return t;
  }
  return { items, loading, fetchAll, create };
});
