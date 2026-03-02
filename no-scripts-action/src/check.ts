import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface ActionInputs {
	path: string;
	exclude: string[];
	failOnViolation: boolean;
}

export interface CheckResult {
	filesChecked: number;
	filesWithScripts: number;
	violations: string[];
}

export function parseList(input: string): string[] {
	return input
		.split(/[\n,]/)
		.map(s => s.trim())
		.filter(s => s.length > 0);
}

export async function findPackageJsonFiles(inputs: ActionInputs): Promise<string[]> {
	const matches = await glob('**/package.json', {
		cwd: inputs.path,
		nodir: true,
		absolute: true,
		ignore: inputs.exclude,
	});
	return matches.sort();
}

export function checkPackageJson(filePath: string): boolean {
	const content = fs.readFileSync(filePath, 'utf-8');
	const pkg = JSON.parse(content);
	return 'scripts' in pkg;
}

export async function runCheck(
	inputs: ActionInputs,
	onWarning?: (message: string) => void,
): Promise<CheckResult> {
	const files = await findPackageJsonFiles(inputs);
	const violations: string[] = [];

	for (const file of files) {
		try {
			if (checkPackageJson(file)) {
				violations.push(file);
			}
		} catch (error) {
			onWarning?.(`Failed to parse ${file}: ${error}`);
		}
	}

	return {
		filesChecked: files.length,
		filesWithScripts: violations.length,
		violations,
	};
}

export function formatReport(result: CheckResult, workdir: string): string {
	const lines: string[] = [];

	lines.push('');
	lines.push('No Scripts Check');
	lines.push('================');
	lines.push('');

	if (result.filesWithScripts === 0) {
		lines.push(`\u2705 All ${result.filesChecked} package.json files are scripts-free`);
		return lines.join('\n');
	}

	lines.push(`\u274c Found ${result.filesWithScripts} package.json files with scripts sections:\n`);

	for (const file of result.violations) {
		const relPath = path.relative(workdir, file);
		lines.push(`  \u2022 ${relPath}`);
	}

	lines.push('\n\ud83d\udca1 Tip: Move scripts to a justfile and remove the scripts section from package.json');

	return lines.join('\n');
}
