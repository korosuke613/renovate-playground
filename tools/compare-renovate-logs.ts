// deno run --allow-net --allow-run --allow-read --allow-write --allow-env tools/compare-renovate-logs.ts

import {readLines} from "https://deno.land/std@0.101.0/io/bufio.ts";

type RenovateLogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
const LogLevels: Record<number, RenovateLogLevel> = {
    10: "TRACE",
    20: "DEBUG",
    30: "INFO",
    40: "WARN",
    50: "ERROR",
    60: "FATAL"
} as const

const getReadableLogLevel = (level: number): RenovateLogLevel => {
    return LogLevels[level];
}

const isImportantLog = (level: number) => {
    switch (getReadableLogLevel(level)){
        case "INFO":
        case "WARN":
        case "ERROR":
        case "FATAL":
            return true;
        default:
            return false;
    }
}

function isDependencyExtraction(arg: RenovateJsonLog): arg is DependencyExtraction {
    return arg.msg.includes("Dependency extraction complete");
}

const getDependencyExtraction = (parsed: RenovateJsonLog) => {
    if(! isDependencyExtraction(parsed)){
        return undefined
    }
    console.debug("Specific Log: Dependency extraction complete")

    const {baseBranch, stats} = parsed
    return {
        baseBranch,
        stats
    }
}

type DependencyExtraction = RenovateJsonLogBase & {
    baseBranch: string;
    stats: Record<string, unknown>;
    msg: `${string}Dependency extraction complete${string}`;
}

function isPackageFilesWithUpdates(arg: RenovateJsonLog): arg is PackageFilesWithUpdates {
    return arg.msg.includes("packageFiles with updates");
}

const getPackageFilesWithUpdates = (parsed: RenovateJsonLog) => {
    if(! isPackageFilesWithUpdates(parsed)){
        return undefined
    }
    console.debug("Specific Log: packageFiles with updates")

    const {baseBranch, config} = parsed
    const orderedConfig: PackageUpdateManagers = {}

    for (const managerName in config) {
        console.debug(`Manager: ${managerName}`)
        const tmpPackageUpdates: PackageUpdateWithKey = {}
        config[managerName].forEach(
            (packageUpdate)=>{
                console.debug(`PackageFile: ${packageUpdate.packageFile}`)
                tmpPackageUpdates[packageUpdate.packageFile] = {}
                packageUpdate.deps.forEach((dep)=>{
                    console.debug(`Dep: ${dep.depName}`)
                    tmpPackageUpdates[packageUpdate.packageFile][dep.depName] = dep
                })
            }
        )
        orderedConfig[managerName] = tmpPackageUpdates
    }

    return {
        baseBranch,
        orderedConfig
    }
}

function isFoundPackageLookupWarnings(arg: RenovateJsonLog): arg is FoundPackageLookupWarnings {
    return arg.msg.includes("Found package lookup warnings");
}

const getFoundPackageLookupWarnings = (parsed: RenovateJsonLog) => {
    if(! isFoundPackageLookupWarnings(parsed)){
        return undefined
    }
    console.debug("Specific Log: Found package lookup warnings")

    const {warnings, warningFiles} = parsed
    return {
        warnings,
        warningFiles
    }
}

type FoundPackageLookupWarnings = RenovateJsonLogBase & {
    warningFiles: string[];
    warnings: string[]
    msg: `${string}Found package lookup warnings${string}`;
}

// function isFullResolvedConfigAndHostRulesIncludingPresets(arg: RenovateJsonLog): arg is FullResolvedConfigAndHostRulesIncludingPresets {
//     return arg.msg.includes("Full resolved config and hostRules including presets");
// }
//
// const getFullResolvedConfigAndHostRulesIncludingPresets = (parsed: RenovateJsonLog) => {
//     if(! isFullResolvedConfigAndHostRulesIncludingPresets(parsed)){
//         return undefined
//     }
//     console.debug("Specific Log: Full resolved config and hostRules including presets")
//
//     const {config} = parsed
//     return {
//         config,
//     }
// }
//
// type FullResolvedConfigAndHostRulesIncludingPresets = RenovateJsonLogBase & {
//     config: Record<string, unknown>;
//     msg: `${string}Full resolved config and hostRules including presets${string}`;
// }

type Dep = {
    [key:string]: unknown;
    depName: string
}

type PackageUpdate = {
    packageFile: string,
    deps: Array<Dep>
}

type PackageUpdateConfig = Record<string, Array<PackageUpdate>>

type PackageUpdateManagers = {
    [manager:string]: PackageUpdateWithKey
}

type PackageUpdateWithKey = {
    [packageFile:string]: {
        [depName:string]: Dep
    }
}

type PackageFilesWithUpdates = RenovateJsonLogBase & {
    baseBranch: string;
    config: PackageUpdateConfig;
    msg: `${string}packageFiles with updates${string}`;
}

type RenovateJsonLogBase = {
    [key:string]: unknown;
    msg: string;
    v: number;
    time: string;
    level: number;
}

type RenovateJsonLog = RenovateJsonLogBase | DependencyExtraction | PackageFilesWithUpdates | FoundPackageLookupWarnings;

const specificLogFunctions: {[key:string]: (parsed: RenovateJsonLog) => undefined | Record<string, unknown>} = {
    "DependencyExtraction": getDependencyExtraction,
    "packageFiles with updates": getPackageFilesWithUpdates,
    "Found package lookup warnings": getFoundPackageLookupWarnings,
    // "Full resolved config and hostRules including presets": getFullResolvedConfigAndHostRulesIncludingPresets
}

const extractLog = async (fileName: string, importantLog = false) => {
    const f = await Deno.open(fileName);

    const logs: Record<string, Array<Record<string, unknown>>> = {}

    for await(const l of readLines(f)) {
        const parsed: RenovateJsonLog = JSON.parse(l)

        for (const key in specificLogFunctions) {
            const specificLog = specificLogFunctions[key](parsed)
            if(specificLog !== undefined){
                if(! Object.hasOwn(logs, key)) logs[key] = []
                logs[key].push(specificLog)
            }
        }

        if(importantLog && isImportantLog(parsed.level)){
            const {msg, level} = {...parsed}
            const readableLogLevel = getReadableLogLevel(level)
            switch (readableLogLevel){
                case "INFO":
                    console.info(`Renovate Message: [${readableLogLevel}] ${msg}`)
                    break;
                case "WARN":
                    console.warn(`Renovate Message: [${readableLogLevel}] ${msg}`)
                    break;
                case "ERROR":
                case "FATAL":
                    console.error(`Renovate Message: [${readableLogLevel}] ${msg}`)
            }
        }
    }

    return logs;
}

console.info("Extract log jsons ./dist/json_default_branch.log");
const defaultBranchLog = await extractLog("./dist/json_default_branch.log")

console.info("Extract log jsons ./dist/json_topic_branch.log");
const topicBranchLog = await extractLog("./dist/json_topic_branch.log", true)

console.info("Save log jsons");

await Deno.mkdir("./dist", {recursive: true});
await Deno.writeTextFile("./dist/default_branch_log.json", JSON.stringify(defaultBranchLog, null, 2));
await Deno.writeTextFile("./dist/topic_branch_log.json", JSON.stringify(topicBranchLog, null, 2));

// console.log(JSON.stringify({defaultBranchLog, topicBranchLog}, null, 2))