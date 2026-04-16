import type { ExtractResult, ParsedCommandArgs } from './types.js';
export declare function extractAndFilterLogs(args: ParsedCommandArgs): Promise<{
    extract: ExtractResult;
    filteredLines: string[];
}>;
