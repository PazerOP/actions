import * as core from '@actions/core';
import * as path from 'path';
import { parseInputs } from './config';
import { runCheck } from './checker';
import { reportToConsole, reportAsAnnotations, setOutputs } from './reporter';

async function run(): Promise<void> {
	try {
		const inputs = parseInputs();
		const workdir = path.resolve(inputs.path);

		core.info(`Checking indentation in: ${workdir}`);
		core.info(`Style: ${inputs.style}`);
		core.info(`Include patterns: ${inputs.include.length}`);
		core.info(`Exclude patterns: ${inputs.exclude.length}`);

		const result = await runCheck(inputs);

		reportToConsole(result, workdir, inputs.style);

		if (process.env.GITHUB_ACTIONS) {
			reportAsAnnotations(result, workdir);
		}

		setOutputs(result);

		if (inputs.failOnViolation && result.filesWithViolations > 0) {
			core.setFailed(
				`Found ${result.totalViolations} indentation violations in ${result.filesWithViolations} files. ` +
				`Expected ${inputs.style} but found incorrect indentation.`
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
