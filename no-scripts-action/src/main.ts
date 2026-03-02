import * as core from '@actions/core';
import * as path from 'path';
import { parseList, runCheck, formatReport, type ActionInputs } from './check';

function parseInputs(): ActionInputs {
	return {
		path: core.getInput('path') || '.',
		exclude: parseList(core.getInput('exclude')),
		failOnViolation: core.getBooleanInput('fail-on-violation'),
	};
}

async function run(): Promise<void> {
	try {
		const inputs = parseInputs();
		const workdir = path.resolve(inputs.path);

		core.info(`Checking for scripts in package.json files in: ${workdir}`);

		const result = await runCheck(inputs, (msg) => core.warning(msg));

		console.log(formatReport(result, workdir));

		for (const file of result.violations) {
			const relPath = path.relative(workdir, file);
			core.error('package.json contains scripts section - use a justfile instead', {
				file: relPath,
				startLine: 1,
				title: 'Scripts Section Found',
			});
		}

		core.setOutput('files-checked', result.filesChecked.toString());
		core.setOutput('files-with-scripts', result.filesWithScripts.toString());
		core.setOutput('violation-list', JSON.stringify(result.violations));

		if (inputs.failOnViolation && result.filesWithScripts > 0) {
			core.setFailed(
				`Found ${result.filesWithScripts} package.json files with scripts sections. ` +
				`Use justfiles instead.`
			);
		}
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			core.setFailed('An unexpected error occurred');
		}
	}
}

run();
