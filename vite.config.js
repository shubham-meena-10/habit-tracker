import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
// eslint-disable-next-line no-unused-vars
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  envDir: './environments', // Specify the directory for environment files
}));