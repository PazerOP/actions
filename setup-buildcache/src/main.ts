import * as core from '@actions/core';
import * as cache from '@actions/cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const GITLAB_RELEASE_BASE = 'https://gitlab.com/bits-n-bites/buildcache/-/releases';
const LIBSSL_DEB_URL = 'http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb';

interface ActionInputs {
	version: string;
	cacheKey: string;
	maxCacheSize: string;
}

function parseInputs(): ActionInputs {
	return {
		version: core.getInput('version') || 'v0.31.5',
		cacheKey: core.getInput('cache-key') || '',
		maxCacheSize: core.getInput('max-cache-size') || '2147483648',
	};
}

function getPlatformInfo(): { os: string; downloadName: string; isArchive: 'tar' | 'zip' } {
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

function getBuildcacheDir(): string {
	return path.join(os.tmpdir(), 'buildcache_bin');
}

function getBuildCacheDir(): string {
	return path.join(os.tmpdir(), 'buildcache_cache');
}

async function restoreBinaryCache(inputs: ActionInputs, platformInfo: ReturnType<typeof getPlatformInfo>): Promise<boolean> {
	const cacheKey = `buildcache-bin-${platformInfo.os}-${inputs.version}`;
	const buildcacheDir = getBuildcacheDir();

	core.info(`Checking for cached buildcache binary: ${cacheKey}`);

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

async function downloadBuildcache(inputs: ActionInputs, platformInfo: ReturnType<typeof getPlatformInfo>): Promise<void> {
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
	} else {
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

async function saveBinaryCache(inputs: ActionInputs, platformInfo: ReturnType<typeof getPlatformInfo>): Promise<void> {
	const cacheKey = `buildcache-bin-${platformInfo.os}-${inputs.version}`;
	const buildcacheDir = getBuildcacheDir();

	core.info(`Caching buildcache binary: ${cacheKey}`);

	try {
		await cache.saveCache([buildcacheDir], cacheKey);
		core.info('Buildcache binary cached successfully');
	} catch (error) {
		// Cache save can fail if the cache already exists
		core.warning(`Failed to cache buildcache binary: ${error}`);
	}
}

async function installLibssl(): Promise<void> {
	if (process.platform !== 'linux') return;

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

async function restoreBuildCache(inputs: ActionInputs): Promise<boolean> {
	const buildCacheDir = getBuildCacheDir();
	const ref = process.env.GITHUB_REF || 'unknown';
	const sha = process.env.GITHUB_SHA || 'unknown';

	const primaryKey = `buildcache-${inputs.cacheKey}-${ref}-${sha}`;
	const restoreKeys = [
		`buildcache-${inputs.cacheKey}-${ref}-`,
		`buildcache-${inputs.cacheKey}-`,
	];

	core.info(`Restoring build cache: ${primaryKey}`);

	const cacheHit = await cache.restoreCache([buildCacheDir], primaryKey, restoreKeys);

	if (cacheHit) {
		core.info('Build cache restored');
		core.setOutput('cache-hit', 'true');
		return true;
	}

	core.info('Build cache not found');
	core.setOutput('cache-hit', 'false');
	return false;
}

async function setupEnvironment(inputs: ActionInputs): Promise<void> {
	const buildcacheDir = getBuildcacheDir();
	const buildCacheDir = getBuildCacheDir();
	const binDir = path.join(buildcacheDir, 'bin');

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

async function verifyInstallation(): Promise<void> {
	core.info('Verifying buildcache installation...');
	await exec.exec('buildcache', ['--version']);
}

async function run(): Promise<void> {
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
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			core.setFailed('An unexpected error occurred');
		}
	}
}

await run();
