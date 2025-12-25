import * as core from '@actions/core';

export type CacheScope = 'repo' | 'branch' | 'commit';

export function getCacheScope(): CacheScope {
	const scope = core.getInput('cache-scope') || 'repo';
	return (scope === 'branch' || scope === 'commit') ? scope : 'repo';
}

export function getBuildCacheKey(cacheKey: string, scope: CacheScope): string {
	const os = process.platform; // linux, darwin, win32
	const base = cacheKey ? `buildcache-${os}-${cacheKey}` : `buildcache-${os}`;
	if (scope === 'repo') {
		return base;
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
		return `${base}-${branch}`;
	}
	const sha = process.env.GITHUB_SHA || 'unknown';
	return `${base}-${branch}-${sha}`;
}
