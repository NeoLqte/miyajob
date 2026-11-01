import {defineConfig,devices} from '@playwright/test';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const localBrowsers=resolve('../.tools/browsers');
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync(localBrowsers))process.env.PLAYWRIGHT_BROWSERS_PATH=localBrowsers;
export default defineConfig({testDir:'./e2e',fullyParallel:false,use:{baseURL:'http://127.0.0.1:4173/miyajob/',colorScheme:'light'},projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173/miyajob/',reuseExistingServer:!process.env.CI}});
