import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/gov': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gov/, ''),
      },
      '/api/seoul': {
        target: 'http://openapi.seoul.go.kr:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/seoul/, ''),
      },
      '/api/gangseo': {
        target: 'http://openAPI.gangseo.seoul.kr:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gangseo/, ''),
      },
      '/api/mapo': {
        target: 'http://openAPI.mapo.go.kr:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mapo/, ''),
      },
      '/api/yongsan': {
        target: 'http://openAPI.yongsan.go.kr:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yongsan/, ''),
      },
      '/api/kakao-geo': {
        target: 'https://dapi.kakao.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kakao-geo/, ''),
        headers: {
          Authorization: 'KakaoAK bebfb73197c72408e6231cbc3e19582a',
        },
      },
    },
  },
})
