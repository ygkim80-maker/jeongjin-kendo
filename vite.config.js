import {defineConfig} from 'vite';
import {resolve} from 'node:path';

export default defineConfig({
  build:{rollupOptions:{input:{main:resolve(import.meta.dirname,'index.html'),v2Demo:resolve(import.meta.dirname,'v2-demo.html')}}},
});
