import { ActionInputs, FileResult, CheckResult } from './types';
export declare function findFiles(inputs: ActionInputs): Promise<string[]>;
export declare function checkFile(filePath: string, inputs: ActionInputs): FileResult;
export declare function runCheck(inputs: ActionInputs): Promise<CheckResult>;
