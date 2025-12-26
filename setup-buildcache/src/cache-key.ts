import * as core from '@actions/core';

export type CacheScope = 'repo' | 'branch' | 'commit';

export interface CacheKeyResult {
	primaryKey: string;
	restoreKeys: string[];
}

export function getCacheScope(): CacheScope {
	const scope = core.getInput('cache-scope') || 'repo';
	return (scope === 'branch' || scope === 'commit') ? scope : 'repo';
}

/**
 * Generates cache key and restore-keys for build cache.
 *
 * GitHub Actions cache is branch-scoped by design. A branch can only access:
 * 1. Caches created by the same branch
 * 2. Caches created by the default branch (main/master)
 *
 * To enable cross-branch cache sharing, we use restore-keys that progressively
 * fall back to broader patterns. This allows feature branches to benefit from
 * caches saved by the default branch.
 *
 * @see https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows#matching-a-cache-key
 */
export function getBuildCacheKey(cacheKey: string, scope: CacheScope): CacheKeyResult {
	const os = process.platform; // linux, darwin, win32
	const baseKey = `buildcache-${os}`;
	const base = cacheKey ? `${baseKey}-${cacheKey}` : baseKey;

	if (scope === 'repo') {
		// For repo scope, use the base key and provide restore-keys for fallback
		// This allows feature branches to access the default branch's cache
		return {
			primaryKey: base,
			restoreKeys: cacheKey ? [baseKey] : [],
		};
	}

	const ref = process.env.GITHUB_REF || '';
	let branch = 'unknown';
	if (ref.startsWith('refs/heads/')) {
		branch = ref.replace('refs/heads/', '');
	} else if (ref.startsWith('refs/pull/')) {
		const prNum = ref.match(/refs\/pull\/(\d+)/)?.[1];
		branch = prNum ? `pr-${prNum}` : 'unknown';
	}

	if (scope === 'branch') {
		// For branch scope, fall back to repo-level cache from default branch
		return {
			primaryKey: `${base}-${branch}`,
			restoreKeys: [base, ...(cacheKey ? [baseKey] : [])],
		};
	}

	// scope === 'commit'
	const sha = process.env.GITHUB_SHA || 'unknown';
	return {
		primaryKey: `${base}-${branch}-${sha}`,
		restoreKeys: [
			`${base}-${branch}`,
			base,
			...(cacheKey ? [baseKey] : []),
		],
	};
}

/**
 * Legacy function for backward compatibility with post.ts save operation.
 * Returns just the primary key string.
 */
export function getBuildCacheKeyString(cacheKey: string, scope: CacheScope): string {
	return getBuildCacheKey(cacheKey, scope).primaryKey;
}
