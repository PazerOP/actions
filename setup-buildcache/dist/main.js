"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const cache = __importStar(require("@actions/cache"));
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
const tc = __importStar(require("@actions/tool-cache"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const cache_key_1 = require("./cache-key");
const GITLAB_RELEASE_BASE = 'https://gitlab.com/bits-n-bites/buildcache/-/releases';
const LIBSSL_DEB_URL = 'http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb';
function parseInputs() {
    return {
        version: core.getInput('version') || 'v0.31.5',
        cacheKey: core.getInput('cache-key') || '',
        cacheScope: (0, cache_key_1.getCacheScope)(),
        maxCacheSize: core.getInput('max-cache-size') || '2147483648',
    };
}
function getPlatformInfo() {
    const platform = process.platform;
    switch (platform) {
        case 'linux':
            return { os: 'linux', downloadName: 'buildcache-linux-amd64.tar.gz', isArchive: 'tar' };
        case 'darwin':
            return { os: 'macos', downloadName: 'buildcache-macos.zip', isArchive: 'zip' };
        case 'win32':
            return { os: 'windows', downloadName: 'buildcache-windows.zip', isArchive: 'zip' };
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}
function getBuildcacheDir() {
    return path.join(os.tmpdir(), 'buildcache_bin');
}
function getBuildCacheDir() {
    return path.join(os.tmpdir(), 'buildcache_cache');
}
async function restoreBinaryCache(inputs, platformInfo) {
    const cacheKey = `buildcache-bin-${platformInfo.os}-${inputs.version}`;
    const buildcacheDir = getBuildcacheDir();
    core.info(`Checking for cached buildcache binary: ${cacheKey}`);
    try {
        const cacheHit = await cache.restoreCache([buildcacheDir], cacheKey);
        if (cacheHit) {
            core.info('Buildcache binary restored from cache');
            core.setOutput('binary-cache-hit', 'true');
            return true;
        }
        core.info('Buildcache binary not in cache');
        core.setOutput('binary-cache-hit', 'false');
        return false;
    }
    catch (error) {
        core.warning(`Failed to restore binary cache: ${error}`);
        core.setOutput('binary-cache-hit', 'false');
        return false;
    }
}
async function downloadBuildcache(inputs, platformInfo) {
    const downloadUrl = `${GITLAB_RELEASE_BASE}/${inputs.version}/downloads/${platformInfo.downloadName}`;
    const buildcacheDir = getBuildcacheDir();
    core.info(`Downloading buildcache from: ${downloadUrl}`);
    const downloadPath = await tc.downloadTool(downloadUrl);
    await io.mkdirP(buildcacheDir);
    if (platformInfo.isArchive === 'tar') {
        // tar.gz - extract with strip-components to flatten
        const extractedDir = await tc.extractTar(downloadPath, os.tmpdir());
        // Move contents from buildcache/ to our target dir
        const sourceDir = path.join(extractedDir, 'buildcache');
        await io.cp(sourceDir, buildcacheDir, { recursive: true, force: true });
    }
    else {
        // zip
        const extractedDir = await tc.extractZip(downloadPath, os.tmpdir());
        // Move contents from buildcache/ to our target dir
        const sourceDir = path.join(extractedDir, 'buildcache');
        await io.cp(sourceDir, buildcacheDir, { recursive: true, force: true });
    }
    // On Linux, also cache libssl1.1 deb
    if (process.platform === 'linux') {
        core.info('Downloading libssl1.1 for Linux compatibility...');
        const debPath = await tc.downloadTool(LIBSSL_DEB_URL);
        const targetDebPath = path.join(buildcacheDir, 'libssl1.1.deb');
        await io.cp(debPath, targetDebPath);
    }
    core.info('Buildcache downloaded successfully');
}
async function saveBinaryCache(inputs, platformInfo) {
    const cacheKey = `buildcache-bin-${platformInfo.os}-${inputs.version}`;
    const buildcacheDir = getBuildcacheDir();
    core.info(`Caching buildcache binary: ${cacheKey}`);
    try {
        await cache.saveCache([buildcacheDir], cacheKey);
        core.info('Buildcache binary cached successfully');
    }
    catch (error) {
        // Cache save can fail if the cache already exists
        core.warning(`Failed to cache buildcache binary: ${error}`);
    }
}
async function installLibssl() {
    if (process.platform !== 'linux')
        return;
    const buildcacheDir = getBuildcacheDir();
    const debPath = path.join(buildcacheDir, 'libssl1.1.deb');
    // Check if libssl1.1 is already installed
    const result = await exec.exec('dpkg', ['-s', 'libssl1.1'], { ignoreReturnCode: true });
    if (result === 0) {
        core.info('libssl1.1 already installed');
        return;
    }
    if (!fs.existsSync(debPath)) {
        core.warning('libssl1.1.deb not found in cache, downloading...');
        const downloadPath = await tc.downloadTool(LIBSSL_DEB_URL);
        await io.cp(downloadPath, debPath);
    }
    core.info('Installing libssl1.1...');
    await exec.exec('sudo', ['dpkg', '-i', debPath]);
}
async function restoreBuildCache(inputs) {
    const buildCacheDir = getBuildCacheDir();
    const primaryKey = (0, cache_key_1.getBuildCacheKey)(inputs.cacheKey, inputs.cacheScope);
    core.info(`Restoring build cache: ${primaryKey}`);
    try {
        const cacheHit = await cache.restoreCache([buildCacheDir], primaryKey);
        if (cacheHit) {
            core.info('Build cache restored');
            core.setOutput('cache-hit', 'true');
            return true;
        }
        core.info('Build cache not found');
        core.setOutput('cache-hit', 'false');
        return false;
    }
    catch (error) {
        core.warning(`Failed to restore build cache: ${error}`);
        core.setOutput('cache-hit', 'false');
        return false;
    }
}
async function setupEnvironment(inputs) {
    const buildcacheDir = getBuildcacheDir();
    const buildCacheDir = getBuildCacheDir();
    // The archive extracts as buildcache/bin/buildcache, and we copy the buildcache dir into buildcacheDir
    const binDir = path.join(buildcacheDir, 'buildcache', 'bin');
    // Add to PATH
    core.addPath(binDir);
    // Set environment variables
    core.exportVariable('BUILDCACHE_DIR', buildCacheDir);
    core.exportVariable('BUILDCACHE_MAX_CACHE_SIZE', inputs.maxCacheSize);
    // Create cache directory if it doesn't exist
    await io.mkdirP(buildCacheDir);
    core.info(`Buildcache configured:`);
    core.info(`  Binary: ${binDir}`);
    core.info(`  Cache: ${buildCacheDir}`);
    core.info(`  Max size: ${inputs.maxCacheSize} bytes`);
}
async function verifyInstallation() {
    core.info('Verifying buildcache installation...');
    await exec.exec('buildcache', ['--version']);
}
async function run() {
    try {
        const inputs = parseInputs();
        const platformInfo = getPlatformInfo();
        core.info(`Setting up buildcache ${inputs.version} for ${platformInfo.os}`);
        // Restore or download buildcache binary
        const binaryHit = await restoreBinaryCache(inputs, platformInfo);
        if (!binaryHit) {
            await downloadBuildcache(inputs, platformInfo);
            await saveBinaryCache(inputs, platformInfo);
        }
        // Install libssl on Linux
        await installLibssl();
        // Restore build cache
        await restoreBuildCache(inputs);
        // Setup environment
        await setupEnvironment(inputs);
        // Verify
        await verifyInstallation();
        core.info('Buildcache setup complete');
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('An unexpected error occurred');
        }
    }
}
run();
