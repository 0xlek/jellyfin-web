/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, normalizePath, type Plugin, type ViteDevServer } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tsconfigPaths from 'vite-tsconfig-paths';

import packageJson from './package.json';

const SRC = path.resolve(__dirname, 'src');
const NODE_MODULES = path.resolve(__dirname, 'node_modules');

/** Files served as-is from the libraries folder, mostly workers that are loaded by URL at runtime. */
/** Themes are built as standalone stylesheets (themes/<id>/theme.css) that the app swaps with a <link>. */
const STYLESHEETS: Record<string, string> = Object.fromEntries(
    globSync('themes/*/theme.scss', { cwd: SRC }).map(file => [ `${path.dirname(file)}/theme.css`, path.join(SRC, file) ])
);
const STYLESHEET_ENTRIES = Object.fromEntries(
    Object.entries(STYLESHEETS).map(([ file, source ]) => [ file.replace(/\.css$/, ''), source ])
);

const TEMPLATE_SUFFIX = '?template';

/**
 * Imported .html files are view templates: expose them as a string, as html-loader did.
 * The id gets a suffix so Vite's own HTML entry handling leaves it alone.
 */
const htmlTemplates = (): Plugin => ({
    name: 'jellyfin:html-templates',
    enforce: 'pre',
    async resolveId(source, importer, options) {
        if (!importer || importer.endsWith('.html') || !source.split('?')[0].endsWith('.html')) return null;
        const resolved = await this.resolve(source.split('?')[0], importer, { ...options, skipSelf: true });
        return resolved ? resolved.id + TEMPLATE_SUFFIX : null;
    },
    load(id) {
        if (!id.endsWith(TEMPLATE_SUFFIX)) return null;
        const file = id.slice(0, -TEMPLATE_SUFFIX.length);
        this.addWatchFile(file);
        return `export default ${JSON.stringify(readFileSync(file, 'utf8'))};`;
    }
});

/** In dev, compile the theme stylesheets on request; the build emits them as CSS entries instead. */
const standaloneStylesheets = (): Plugin => ({
    name: 'jellyfin:stylesheets',
    configureServer(server: ViteDevServer) {
        server.middlewares.use(async (req, res, next) => {
            const source = STYLESHEETS[(req.url ?? '').split('?')[0].slice(1)];
            if (!source) return next();
            try {
                const { default: css } = await server.ssrLoadModule(`${source}?inline`);
                res.setHeader('Content-Type', 'text/css');
                res.end(css);
            } catch (err) {
                next(err);
            }
        });
    }
});

const getCommitSha = () => {
    // Container builds have no .git; CI passes the commit instead
    if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA;
    try {
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        return execSync('git describe --always --dirty').toString().trim();
    } catch {
        return '';
    }
};

export default defineConfig(({ command, mode }) => {
    const isTest = mode === 'test' || !!process.env.VITEST;
    const isServe = command === 'serve' && !isTest;

    return {
        root: SRC,
        base: './',
        publicDir: false,
        resolve: {
            // Stylesheets still use webpack's "~package" prefix for files in node_modules
            alias: [ { find: /^~(.+)$/, replacement: '$1' } ]
        },
        define: {
            __COMMIT_SHA__: JSON.stringify(getCommitSha()),
            __JF_BUILD_VERSION__: JSON.stringify(isServe ? 'Dev Server' : process.env.JELLYFIN_VERSION || 'Release'),
            __PACKAGE_JSON_NAME__: JSON.stringify(packageJson.name),
            __PACKAGE_JSON_VERSION__: JSON.stringify(packageJson.version),
            __USE_SYSTEM_FONTS__: JSON.stringify(!!JSON.parse(process.env.USE_SYSTEM_FONTS || '0')),
            __WEBPACK_SERVE__: JSON.stringify(isServe)
        },
        plugins: [
            tsconfigPaths({ projects: [ path.resolve(__dirname, 'tsconfig.json') ] }),
            htmlTemplates(),
            ...(isTest ? [] : [
                standaloneStylesheets(),
                // Files under src/ are already served by the dev server, so they are only copied into the build
                ...viteStaticCopy({
                    // The service worker is a small standalone script, registered by URL
                    targets: [ 'assets', 'config.json', 'robots.txt', 'manifest.json', 'serviceworker.js' ]
                        .map(file => ({ src: normalizePath(path.join(SRC, file)), dest: '.' }))
                }).filter(plugin => plugin.apply !== 'serve'),
                viteStaticCopy({
                    targets: [
                        { src: normalizePath(path.join(NODE_MODULES, '@jellyfin/ux-web/favicons/touchicon*.png')), dest: 'favicons', rename: { stripBase: true } }
                    ]
                })
            ])
        ],
        css: {
            postcss: __dirname,
            preprocessorOptions: {
                scss: {
                    // The stylesheets predate the Sass module system
                    silenceDeprecations: [ 'import', 'global-builtin', 'color-functions' ]
                }
            }
        },
        build: {
            target: 'es2022',
            outDir: path.resolve(__dirname, 'dist'),
            emptyOutDir: true,
            sourcemap: false,
            rollupOptions: {
                input: {
                    main: path.join(SRC, 'index.html'),
                    ...STYLESHEET_ENTRIES
                },
                output: {
                    assetFileNames: asset => {
                        const name = asset.names?.[0] ?? '';
                        return name in STYLESHEETS ? name : 'assets/[name]-[hash][extname]';
                    }
                }
            }
        },
        server: {
            host: '127.0.0.1'
        },
        optimizeDeps: {
            // Most pages load lazily; crawl everything up front so dependencies are not re-optimized mid-session
            entries: [ 'index.html', '**/*.{js,jsx,ts,tsx}', '!**/*.test.*', '!**/*.d.ts' ]
        },
        test: {
            root: __dirname,
            coverage: {
                include: [ 'src' ]
            },
            environment: 'jsdom',
            restoreMocks: true
        }
    };
});
