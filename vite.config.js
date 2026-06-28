import { defineConfig } from 'vite';
import yaml from 'vite-plugin-yaml2';

export default defineConfig({
  plugins: [yaml()],
  base: '/jira-workflow/',
});
