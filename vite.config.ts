import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            // Vendor splits: keep heavy libs out of the app shell chunk.
            { name: 'vendor-react', test: /node_modules\/(react|react-dom|react-router-dom)/ },
            { name: 'vendor-motion', test: /node_modules\/framer-motion/ },
            { name: 'vendor-query', test: /node_modules\/@tanstack\/react-query/ },
            { name: 'vendor-supabase', test: /node_modules\/@supabase/ },
            { name: 'vendor-forms', test: /node_modules\/(react-hook-form|@hookform|zod)/ },
            { name: 'vendor-utils', test: /node_modules\/(date-fns|lucide-react|clsx|tailwind-merge|class-variance-authority)/ },
          ],
        },
      },
    },
  },
})
