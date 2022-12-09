// deno run --allow-net --allow-run --allow-read --allow-env tools/extract-log-experiment.ts

import {readLines} from "https://deno.land/std@0.101.0/io/bufio.ts";

const matchMessage = (msg: string) => {
    const match = [
        "File config",
        "CLI config",
        "Env config",
        "Combined config",
        "Platform config",
        "massaged config",
        "migrated config",
        "Full resolved config and hostRules including presets",
        "Dependency extraction complete",
        "packageFiles with updates",
        "Branch lists",
        "Found package lookup warnings"
    ].some((m) => msg.includes(m))

    return match
}

const LogLevels = {
    10: "TRACE",
    20: "DEBUG",
    30: "INFO",
    40: "WARN",
    50: "ERROR",
    60: "FATAL"
}

const getReadableLogLevel = (level: number) => {
    return LogLevels[level]
}

const isImportantLog = (level: number) => {
    switch (getReadableLogLevel(level)){
        case LogLevels["30"]:
        case LogLevels["40"]:
        case LogLevels["50"]:
        case LogLevels["60"]:
            return true;
        default:
            return false;
    }
}

const usefulLogs: Record<string, unknown> = {}
const importantLogs: Record<string, unknown> = {}

const f = await Deno.open('./renovate-logs/renovate2_failed.log');

for await(const l of readLines(f)) {
    const parsed: {
        [key: string]: unknown,
        level: number,
        msg: string,
        config?: Record<string, unknown>
        platformConfig?: Record<string, unknown>,
        warnings?: Array<string>,
        warningFiles?: Array<string>,
        stats?: Record<string, unknown>
    } = JSON.parse(l)
    if (matchMessage(parsed.msg)) {
        const {msg, config, platformConfig, level, warnings, warningFiles, stats} = {...parsed}
        usefulLogs[msg] = {
            config,
            level: getReadableLogLevel(level),
            platformConfig,
            warnings,
            warningFiles,
            stats
        }
    }else if(isImportantLog(parsed.level)){
        const {msg, config, platformConfig, level, warnings, warningFiles, stats} = {...parsed}
        importantLogs[msg] = {
            config,
            level: getReadableLogLevel(level),
            platformConfig,
            warnings,
            warningFiles,
            stats
        }
    }
}

console.log(JSON.stringify({usefulLogs, importantLogs}, null, 2))
