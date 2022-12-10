const fs = require('fs');
const configFilePath = "./renovate.json";
const configFileText = fs.readFileSync(configFilePath, "utf8");

module.exports = {
    "dryRun": "full",
    "fetchReleaseNotes": false,

    // This ignores the config that's in the repository.
    "requireConfig": "ignored",
    // Wrapping it in force is necessary, because otherwise the `ignorePaths` from the extended base config is used,
    // rather than from the loaded JSON. REPORT this sounds like a bug.
    "force": {
        // This loads a local file instead.
        ...JSON.parse(configFileText)
    }
};
