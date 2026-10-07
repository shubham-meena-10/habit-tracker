import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// The default maskable/apple icons get a white border. Fill it with the brand colour instead.
const fill = { fit: 'contain', background: '#0f766e' };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: fill },
    apple: { ...minimal2023Preset.apple, resizeOptions: fill },
  },
  images: ['public/icon.svg'],
});