import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import cloudflare from '@astrojs/cloudflare'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    output: 'server',
    adapter: cloudflare({
        platformProxy: { enabled: true },
    }),
    integrations: [react()],
    vite: {
        plugins: [tailwindcss()],
        server: {
            watch: {
                ignored: ['**/.wrangler/**', '**/node_modules/**'],
            },
        },
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
                '@treonstudio/bungas-core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
            },
        },
        build: {
            sourcemap: true,
        },
    },
    image: {
        domains: ['ik.imagekit.io', 'images.unsplash.com', 'avatars.githubusercontent.com'],
    },
})
