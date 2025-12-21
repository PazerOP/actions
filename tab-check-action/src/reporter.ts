import * as core from '@actions/core';
import * as path from 'path';
import { CheckResult, Violation } from './types';

export function formatViolation(v: Violation, workdir: string): string {
	const relPath = path.relative(workdir, v.file);
	const preview = v.content.substring(0, 80) + (v.content.length > 80 ? '...' : '');
	const visiblePreview = preview
		.replace(/\t/g, '\u2192   ')
		.replace(/ /g, '\u00b7');
	return `  ${relPath}:${v.line} - found ${v.found}, expected ${v.expected}\n    ${visiblePreview}`;
}

export function reportToConsole(result: CheckResult, workdir: string, style: string): void {
	console.log('');
	console.log('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
	console.log(`\u2551  Tab Indentation Check - Enforcing: ${style.toUpperCase().padEnd(22)}\u2551`);
	console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');
	console.log('');

	if (result.filesWithViolations === 0) {
		console.log(`\u2705 All ${result.filesChecked} files use correct indentation (${style})`);
		return;
	}

	console.log(`\u274c Found ${result.totalViolations} violations in ${result.filesWithViolations} of ${result.filesChecked} files\n`);

	for (const fileResult of result.fileResults) {
		if (fileResult.violations.length === 0) continue;

		const relPath = path.relative(workdir, fileResult.file);
		console.log(`\n\ud83d\udcc4 ${relPath} (${fileResult.violations.length} violations):`);

		for (const violation of fileResult.violations) {
			console.log(formatViolation(violation, workdir));
		}
	}

	console.log('\n');
	console.log(`\ud83d\udca1 Tip: Configure your editor to use ${style} for indentation.`);
	console.log('   Most editors can convert existing indentation automatically.');
}

export function reportAsAnnotations(result: CheckResult, workdir: string): void {
	for (const fileResult of result.fileResults) {
		for (const violation of fileResult.violations) {
			const relPath = path.relative(workdir, violation.file);
			const message = `Line uses ${violation.found} indentation, expected ${violation.expected}`;

			core.error(message, {
				file: relPath,
				startLine: violation.line,
				title: 'Indentation Violation',
			});
		}
	}
}

export function setOutputs(result: CheckResult): void {
	core.setOutput('total-files-checked', result.filesChecked.toString());
	core.setOutput('files-with-violations', result.filesWithViolations.toString());
	core.setOutput('total-violations', result.totalViolations.toString());

	const violationList = result.fileResults
		.filter(fr => fr.violations.length > 0)
		.map(fr => ({
			file: fr.file,
			count: fr.violations.length,
			lines: fr.violations.map(v => v.line),
		}));

	core.setOutput('violation-list', JSON.stringify(violationList));
}
