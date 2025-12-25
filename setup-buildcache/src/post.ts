import * as core from '@actions/core';
import * as cache from '@actions/cache';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as os from 'os';
import { getCacheScope, getBuildCacheKey } from './cache-key';

function getBuildCacheDir(): string {
	return path.join(os.tmpdir(), 'buildcache_cache');
}

async function showStats(): Promise<void> {
	core.info('Buildcache statistics:');
	try {
		await exec.exec('buildcache', ['-s']);
	} catch {
		core.warning('Failed to get buildcache stats');
	}
}

async function saveBuildCache(): Promise<void> {
	const buildCacheDir = getBuildCacheDir();
	const cacheKey = core.getInput('cache-key') || '';
	const primaryKey = getBuildCacheKey(cacheKey, getCacheScope());

	core.info(`Saving build cache: ${primaryKey}`);

	try {
		const cacheId = await cache.saveCache([buildCacheDir], primaryKey);
		if (cacheId !== -1) {
			core.info('Build cache saved successfully');
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes('already exists')) {
			core.info('Cache already exists, skipping save');
		} else {
			core.warning(`Failed to save build cache: ${error}`);
		}
	}
}

async function run(): Promise<void> {
	try {
		await showStats();
		await saveBuildCache();
	} catch (error) {
		// Don't fail the job on post-action errors
		if (error instanceof Error) {
			core.warning(`Post action error: ${error.message}`);
		}
	}
}

run();
