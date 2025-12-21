import * as core from '@actions/core';
import { ActionInputs } from './types';

export function parseInputs(): ActionInputs {
	const parseList = (input: string): string[] => {
		return input
			.split(/[\n,]/)
			.map(s => s.trim())
			.filter(s => s.length > 0);
	};

	const style = core.getInput('style').toLowerCase();
	if (style !== 'tabs' && style !== 'spaces') {
		throw new Error(`Invalid style "${style}". Must be "tabs" or "spaces".`);
	}

	return {
		path: core.getInput('path') || '.',
		include: parseList(core.getInput('include')),
		exclude: parseList(core.getInput('exclude')),
		style: style as 'tabs' | 'spaces',
		ignoreBlankLines: core.getBooleanInput('ignore-blank-lines'),
		ignoreComments: core.getBooleanInput('ignore-comments'),
		failOnViolation: core.getBooleanInput('fail-on-violation'),
		maxViolationsPerFile: parseInt(core.getInput('max-violations-per-file'), 10) || 0,
	};
}
