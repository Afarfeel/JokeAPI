// The main coordination file of JokeAPI
// This file starts all necessary modules like the joke parser, the JokeAPI Documentation page injection and the HTTP listener, etc.

"use strict";


const jsl = require("svjsl");
const fs = require("fs-extra");
const promiseAllSequential = require("promise-all-sequential");

const settings = require("../settings");
const debug = require("./debug");
const parseJokes = require("./parseJokes");
const httpServer = require("./httpServer");
const lists = require("./lists");
const docs = require("./docs");
const analytics = require("./analytics");
const logRequest = require("./logRequest");
const auth = require("./auth");
const languages = require("./languages");
const translate = require("./translate");
const meter = require("./meter");
const jokeCache = require("./jokeCache");
const parseURL = require("./parseURL");

const col = jsl.colors.fg;
process.debuggerActive = jsl.inDebugger();
const noDbg = process.debuggerActive || false;

require("dotenv").config();

settings.init.exitSignals.forEach(sig => {
    process.on(sig, () => softExit(0));
});

//#MARKER init all
function initAll()
{
    let initTimestamp = Date.now();

    process.jokeapi = {};
    initializeDirs();

    let initPromises = [];
    let initStages = [
        {
            name: "Languages",
            fn: languages.init
        },
        {
            name: "Translations",
            fn: translate.init
        },
        {
            name: "Joke parser",
            fn: parseJokes.init
        },
        {
            name: "Lists",
            fn: lists.init
        },
        {
            name: "Documentation",
            fn: docs.init
        },
        {
            name: "Authorization module",
            fn: auth.init
        },
        {
            name: "URL parser",
            fn: parseURL.init
        },
        {
            name: "HTTP server",
            fn: httpServer.init
        },
        {
            name: "Analytics module",
            fn: analytics.init
        },
        {
            name: "Joke Cache",
            fn: jokeCache.init
        },
        {
            name: "Pm2 meter",
            fn: meter.init
        }
    ];

    let pb;
    if(!noDbg && !settings.debug.progressBarDisabled)
        pb = new jsl.ProgressBar(initStages.length, `Initializing ${initStages[0].name}`);

    initStages.forEach(stage => {
        initPromises.push(stage.fn);
    });

    debug("Init", `Sequentially initializing all ${initStages.length} modules...`);

    promiseAllSequential(initPromises).then((res) => {
        jsl.unused(res);

        // //#DEBUG#
        // require("./jokeCache").cache.listEntries("eff8e7ca506627fe15dda5e0e512fcaad70b6d520f37cc76597fdb4f2d83a1a3", "de").then(res => {
        //     console.log(res);
        // }).catch(err => {
        //     console.error(`Err: ${err}`);
        // });
        // //#DEBUG#

        if(!jsl.isEmpty(pb))
            pb.next("Done.");

        debug("Init", `Successfully initialized all ${initStages.length} modules. Printing init message:\n`);

        logRequest.initMsg(initTimestamp);
    }).catch(err => {
        initError("initializing", err);
    });
}


//#MARKER other

/**
 * This function gets called when JokeAPI encounters an error while initializing.
 * Because the initialization phase is such a delicate and important process, JokeAPI shuts down if an error is encountered.
 * @param {String} action 
 * @param {Error} err 
 */
function initError(action, err)
{
    let errMsg = err.stack || err || "(No error message provided)";
    console.log(`\n\n\n${col.red}JokeAPI encountered an error while ${action}:\n${errMsg}\n\n${jsl.colors.rst}`);
    process.exit(1);
}

/**
 * Makes sure all directories exist and creates them if they don't
 */
function initializeDirs()
{
    try
    {
        settings.init.initDirs.forEach(dir => {
            if(!fs.existsSync(dir))
            {
                debug("InitDirs", `Dir "${dir}" doesn't exist, creating it...`);
                fs.mkdirSync(dir);
            }
        });
    }
    catch(err)
    {
        initError("initializing default directories", err);
    }
}

/**
 * Ends all open connections and then shuts down the process with the specified exit code
 * @param {Number} [code=0] Exit code - defaults to 0
 */
function softExit(code)
{
    if(typeof code != "number" || code < 0)
        code = 0;

    analytics.endSqlConnection().then(() => process.exit(code)).catch(() => process.exit(code));
}


module.exports = { softExit };
initAll();
