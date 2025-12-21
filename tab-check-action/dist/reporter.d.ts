import { CheckResult, Violation } from './types';
export declare function formatViolation(v: Violation, workdir: string): string;
export declare function reportToConsole(result: CheckResult, workdir: string, style: string): void;
export declare function reportAsAnnotations(result: CheckResult, workdir: string): void;
export declare function setOutputs(result: CheckResult): void;
