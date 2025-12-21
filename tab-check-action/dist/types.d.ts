export interface ActionInputs {
    path: string;
    include: string[];
    exclude: string[];
    style: 'tabs' | 'spaces';
    ignoreBlankLines: boolean;
    ignoreComments: boolean;
    failOnViolation: boolean;
    maxViolationsPerFile: number;
}
export interface Violation {
    file: string;
    line: number;
    content: string;
    expected: 'tab' | 'space';
    found: 'tab' | 'space' | 'mixed';
    indentLength: number;
}
export interface FileResult {
    file: string;
    violations: Violation[];
    linesChecked: number;
}
export interface CheckResult {
    filesChecked: number;
    filesWithViolations: number;
    totalViolations: number;
    fileResults: FileResult[];
}
