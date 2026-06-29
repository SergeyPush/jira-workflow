import { defineConfig } from 'vite';
import yaml from 'vite-plugin-yaml2';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), svelte(), yaml()],
  base: '/jira-workflow/',
});
