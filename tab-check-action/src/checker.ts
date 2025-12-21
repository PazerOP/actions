import * as fs from 'fs';
import { glob } from 'glob';
import { ActionInputs, Violation, FileResult, CheckResult } from './types';

const LEADING_WHITESPACE = /^(\s+)/;
const STARTS_WITH_TAB = /^\t/;
const STARTS_WITH_SPACE = /^ /;
const ONLY_WHITESPACE = /^\s*$/;

export async function findFiles(inputs: ActionInputs): Promise<string[]> {
	const allFiles: Set<string> = new Set();

	for (const pattern of inputs.include) {
		const matches = await glob(pattern, {
			cwd: inputs.path,
			nodir: true,
			absolute: true,
			ignore: inputs.exclude,
		});
		matches.forEach(f => allFiles.add(f));
	}

	return Array.from(allFiles).sort();
}

export function checkFile(filePath: string, inputs: ActionInputs): FileResult {
	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');
	const violations: Violation[] = [];

	let inMultiLineComment = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		if (inputs.ignoreBlankLines && ONLY_WHITESPACE.test(line)) {
			continue;
		}

		if (inputs.ignoreComments) {
			if (line.includes('/*') && !line.includes('*/')) {
				inMultiLineComment = true;
			}
			if (inMultiLineComment) {
				if (line.includes('*/')) {
					inMultiLineComment = false;
				}
				continue;
			}
		}

		const match = line.match(LEADING_WHITESPACE);
		if (!match) continue;

		const indent = match[1];
		const hasTabs = indent.includes('\t');
		const hasSpaces = indent.includes(' ');

		let violation: Violation | null = null;

		if (inputs.style === 'tabs') {
			if (STARTS_WITH_SPACE.test(indent)) {
				violation = {
					file: filePath,
					line: lineNum,
					content: line,
					expected: 'tab',
					found: hasTabs && hasSpaces ? 'mixed' : 'space',
					indentLength: indent.length,
				};
			}
		} else {
			if (STARTS_WITH_TAB.test(indent)) {
				violation = {
					file: filePath,
					line: lineNum,
					content: line,
					expected: 'space',
					found: hasTabs && hasSpaces ? 'mixed' : 'tab',
					indentLength: indent.length,
				};
			}
		}

		if (violation) {
			violations.push(violation);
		}
	}

	return {
		file: filePath,
		violations,
		linesChecked: lines.length,
	};
}

export async function runCheck(inputs: ActionInputs): Promise<CheckResult> {
	const files = await findFiles(inputs);
	const fileResults: FileResult[] = [];
	let totalViolations = 0;
	let filesWithViolations = 0;

	for (const file of files) {
		const result = checkFile(file, inputs);

		if (result.violations.length > 0) {
			filesWithViolations++;
			totalViolations += result.violations.length;

			if (inputs.maxViolationsPerFile > 0) {
				result.violations = result.violations.slice(0, inputs.maxViolationsPerFile);
			}
		}

		fileResults.push(result);
	}

	return {
		filesChecked: files.length,
		filesWithViolations,
		totalViolations,
		fileResults,
	};
}
