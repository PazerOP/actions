import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

interface SizeEntry {
	path: string;
	bytes: number;
	humanSize: string;
}

function parseInputs(): { paths: string[]; depth: number } {
	const raw = core.getInput('paths', { required: true });
	const paths = raw
		.split(/[\n,]/)
		.map(s => s.trim())
		.filter(s => s.length > 0);

	const depth = parseInt(core.getInput('depth') || '1', 10);

	return { paths, depth };
}

function humanBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const val = bytes / Math.pow(1024, i);
	return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function dirSizeSync(dirPath: string): number {
	let total = 0;
	let entries: fs.Dirent[];

	try {
		entries = fs.readdirSync(dirPath, { withFileTypes: true });
	} catch {
		return 0;
	}

	for (const entry of entries) {
		const full = path.join(dirPath, entry.name);
		if (entry.isSymbolicLink()) {
			// Count symlink itself but don't follow to avoid cycles
			try {
				total += fs.lstatSync(full).size;
			} catch {
				// ignore
			}
		} else if (entry.isDirectory()) {
			total += dirSizeSync(full);
		} else {
			try {
				total += fs.statSync(full).size;
			} catch {
				// ignore
			}
		}
	}
	return total;
}

function collectEntries(targetPath: string, maxDepth: number): SizeEntry[] {
	const results: SizeEntry[] = [];

	function walk(current: string, currentDepth: number): void {
		const bytes = dirSizeSync(current);
		results.push({ path: current, bytes, humanSize: humanBytes(bytes) });

		if (currentDepth >= maxDepth) return;

		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (entry.isDirectory() && !entry.isSymbolicLink()) {
				walk(path.join(current, entry.name), currentDepth + 1);
			}
		}
	}

	const stat = fs.statSync(targetPath, { throwIfNoEntry: false });
	if (!stat) {
		core.warning(`Path does not exist: ${targetPath}`);
		return results;
	}

	if (stat.isDirectory()) {
		walk(targetPath, 0);
	} else {
		// Single file
		results.push({ path: targetPath, bytes: stat.size, humanSize: humanBytes(stat.size) });
	}

	return results;
}

function renderTable(entries: SizeEntry[], topLevelPaths: Set<string>): void {
	if (entries.length === 0) return;

	const maxPathLen = Math.max(...entries.map(e => e.path.length), 'Path'.length);
	const maxSizeLen = Math.max(...entries.map(e => e.humanSize.length), 'Size'.length);

	const separator = `+-${'-'.repeat(maxPathLen)}-+-${'-'.repeat(maxSizeLen)}-+`;
	const header = `| ${'Path'.padEnd(maxPathLen)} | ${'Size'.padEnd(maxSizeLen)} |`;

	console.log(separator);
	console.log(header);
	console.log(separator);

	for (const entry of entries) {
		const isTop = topLevelPaths.has(entry.path);
		const prefix = isTop ? '' : '  ';
		const displayPath = (prefix + entry.path).padEnd(maxPathLen);
		console.log(`| ${displayPath} | ${entry.humanSize.padEnd(maxSizeLen)} |`);
	}

	console.log(separator);
}

async function run(): Promise<void> {
	try {
		const { paths, depth } = parseInputs();

		console.log('');
		console.log('Cache Size Breakdown');
		console.log('====================');
		console.log('');

		const allEntries: SizeEntry[] = [];
		const topLevelPaths = new Set<string>();

		for (const p of paths) {
			const resolved = path.resolve(p);
			topLevelPaths.add(resolved);
			const entries = collectEntries(resolved, depth);
			allEntries.push(...entries);
		}

		if (allEntries.length === 0) {
			console.log('No paths found to analyze.');
			core.setOutput('total-bytes', '0');
			core.setOutput('size-breakdown', '[]');
			return;
		}

		renderTable(allEntries, topLevelPaths);

		// Total = sum of just the top-level paths
		const totalBytes = allEntries
			.filter(e => topLevelPaths.has(e.path))
			.reduce((sum, e) => sum + e.bytes, 0);

		console.log('');
		console.log(`Total: ${humanBytes(totalBytes)}`);
		console.log('');

		core.setOutput('total-bytes', totalBytes.toString());
		core.setOutput('size-breakdown', JSON.stringify(allEntries));
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			core.setFailed('An unexpected error occurred');
		}
	}
}

run();
