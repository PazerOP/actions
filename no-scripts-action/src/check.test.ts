import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
	parseList,
	checkPackageJson,
	findPackageJsonFiles,
	runCheck,
	formatReport,
	type ActionInputs,
} from './check';

function createTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'no-scripts-test-'));
}

function writeJson(filePath: string, content: object): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
}

describe('parseList', () => {
	it('splits on newlines', () => {
		expect(parseList('a\nb\nc')).toEqual(['a', 'b', 'c']);
	});

	it('splits on commas', () => {
		expect(parseList('a,b,c')).toEqual(['a', 'b', 'c']);
	});

	it('trims whitespace', () => {
		expect(parseList('  a , b \n c  ')).toEqual(['a', 'b', 'c']);
	});

	it('filters empty entries', () => {
		expect(parseList('a,,b\n\nc')).toEqual(['a', 'b', 'c']);
	});

	it('returns empty array for empty string', () => {
		expect(parseList('')).toEqual([]);
	});
});

describe('checkPackageJson', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true });
	});

	it('returns true when package.json has scripts', () => {
		const filePath = path.join(tmpDir, 'package.json');
		writeJson(filePath, {
			name: 'test',
			scripts: { test: 'echo test' },
		});
		expect(checkPackageJson(filePath)).toBe(true);
	});

	it('returns true even when scripts is empty', () => {
		const filePath = path.join(tmpDir, 'package.json');
		writeJson(filePath, {
			name: 'test',
			scripts: {},
		});
		expect(checkPackageJson(filePath)).toBe(true);
	});

	it('returns false when package.json has no scripts', () => {
		const filePath = path.join(tmpDir, 'package.json');
		writeJson(filePath, {
			name: 'test',
			version: '1.0.0',
		});
		expect(checkPackageJson(filePath)).toBe(false);
	});

	it('throws on invalid JSON', () => {
		const filePath = path.join(tmpDir, 'package.json');
		fs.writeFileSync(filePath, '{ invalid json }');
		expect(() => checkPackageJson(filePath)).toThrow();
	});
});

describe('findPackageJsonFiles', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true });
	});

	it('finds package.json in root', async () => {
		writeJson(path.join(tmpDir, 'package.json'), { name: 'root' });

		const inputs: ActionInputs = { path: tmpDir, exclude: [], failOnViolation: true };
		const files = await findPackageJsonFiles(inputs);
		expect(files).toHaveLength(1);
		expect(files[0]).toContain('package.json');
	});

	it('finds package.json in nested directories', async () => {
		writeJson(path.join(tmpDir, 'package.json'), { name: 'root' });
		writeJson(path.join(tmpDir, 'packages', 'a', 'package.json'), { name: 'a' });
		writeJson(path.join(tmpDir, 'packages', 'b', 'package.json'), { name: 'b' });

		const inputs: ActionInputs = { path: tmpDir, exclude: [], failOnViolation: true };
		const files = await findPackageJsonFiles(inputs);
		expect(files).toHaveLength(3);
	});

	it('excludes patterns', async () => {
		writeJson(path.join(tmpDir, 'package.json'), { name: 'root' });
		writeJson(path.join(tmpDir, 'node_modules', 'dep', 'package.json'), { name: 'dep' });

		const inputs: ActionInputs = {
			path: tmpDir,
			exclude: ['**/node_modules/**'],
			failOnViolation: true,
		};
		const files = await findPackageJsonFiles(inputs);
		expect(files).toHaveLength(1);
		expect(files[0]).not.toContain('node_modules');
	});

	it('returns empty array when no package.json exists', async () => {
		const inputs: ActionInputs = { path: tmpDir, exclude: [], failOnViolation: true };
		const files = await findPackageJsonFiles(inputs);
		expect(files).toHaveLength(0);
	});

	it('returns sorted results', async () => {
		writeJson(path.join(tmpDir, 'z', 'package.json'), { name: 'z' });
		writeJson(path.join(tmpDir, 'a', 'package.json'), { name: 'a' });
		writeJson(path.join(tmpDir, 'm', 'package.json'), { name: 'm' });

		const inputs: ActionInputs = { path: tmpDir, exclude: [], failOnViolation: true };
		const files = await findPackageJsonFiles(inputs);
		expect(files).toEqual([...files].sort());
	});
});

describe('runCheck', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true });
	});

	it('reports no violations when no scripts exist', async () => {
		writeJson(path.join(tmpDir, 'package.json'), { name: 'clean' });
		writeJson(path.join(tmpDir, 'lib', 'package.json'), { name: 'lib' });

		const inputs: ActionInputs = { path: tmpDir, exclude: [], failOnViolation: true };
		const result = await runCheck(inputs);

		expect(result.filesChecked).toBe(2);
		expect(result.filesWithScripts).toBe(0);
		expect(result.violations).toEqual([]);
	});

	it('detects violations', async () => {
		writeJson(path.join(tmpDir, 'package.json'), { name: 'clean' });
		writeJson(path.join(tmpDir, 'bad', 'package.json'), {
			name: 'bad',
			scripts: { test: 'jest' },
		});

		const inputs: ActionInputs = { path: tmpDir, exclude: [], failOnViolation: true };
		const result = await runCheck(inputs);

		expect(result.filesChecked).toBe(2);
		expect(result.filesWithScripts).toBe(1);
		expect(result.violations).toHaveLength(1);
		expect(result.violations[0]).toContain(path.join('bad', 'package.json'));
	});

	it('calls onWarning for invalid JSON', async () => {
		fs.writeFileSync(path.join(tmpDir, 'package.json'), 'not json');

		const warnings: string[] = [];
		const inputs: ActionInputs = { path: tmpDir, exclude: [], failOnViolation: true };
		const result = await runCheck(inputs, (msg) => warnings.push(msg));

		expect(result.filesChecked).toBe(1);
		expect(result.filesWithScripts).toBe(0);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('Failed to parse');
	});

	it('respects exclude patterns', async () => {
		writeJson(path.join(tmpDir, 'package.json'), { name: 'root', scripts: {} });
		writeJson(path.join(tmpDir, 'vendor', 'package.json'), { name: 'vendor', scripts: {} });

		const inputs: ActionInputs = {
			path: tmpDir,
			exclude: ['**/vendor/**'],
			failOnViolation: true,
		};
		const result = await runCheck(inputs);

		expect(result.filesChecked).toBe(1);
		expect(result.filesWithScripts).toBe(1);
		expect(result.violations[0]).not.toContain('vendor');
	});
});

describe('formatReport', () => {
	it('shows success message when no violations', () => {
		const result = { filesChecked: 5, filesWithScripts: 0, violations: [] };
		const report = formatReport(result, '/work');
		expect(report).toContain('All 5 package.json files are scripts-free');
	});

	it('shows violations with relative paths', () => {
		const result = {
			filesChecked: 3,
			filesWithScripts: 2,
			violations: ['/work/a/package.json', '/work/b/package.json'],
		};
		const report = formatReport(result, '/work');
		expect(report).toContain('Found 2 package.json files with scripts sections');
		expect(report).toContain(path.join('a', 'package.json'));
		expect(report).toContain(path.join('b', 'package.json'));
		expect(report).toContain('justfile');
	});
});
