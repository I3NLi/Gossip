/**
 * @fileoverview This is a brief description of your file.
 * @module GossIpServerExample 
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import GossipServer, { defaultConfig, Config } from "./GossIpServer";
import fs from 'fs';
import ini from 'ini';
import dns from 'dns';
/**
 * Represents the INI configuration for your application.
 * @typedef {Object} IniConfig
 * @property {number} degree - The degree property.
 * @property {number} cache_size - The cache size property.
 * @property {string} bootstrapper - The bootstrapper property.
 * @property {string} api_address - The API address property.
 * @property {string} p2p_address - The P2P address property.
 */

/**
 * Parses the INI configuration file.
 * @param {string} path - The path to the INI configuration file.
 * @returns {IniConfig} The parsed INI configuration.
 */
const iniConfig: IniConfig = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

/**
 * Represents the application configuration.
 * @type {Config}
 */
const config: Config = { ...defaultConfig };

// Set configuration properties based on INI file values
config.MAX_SIZE_OF_PEERS = iniConfig.gossip.degree;
config.CACHE_SIZE = iniConfig.gossip.cache_size;
dns.resolve(iniConfig.gossip.bootstrapper, (err, addresses) => {
    if (err) {
        console.error(`Error: ${err.message}`);
        return;
    }

    config.BOOTSTRAPPER = addresses[0];
});
config.INTERN_PORT = iniConfig.gossip.api_address.split(":").pop();

dns.resolve(iniConfig.gossip.p2p_address, (err, addresses) => {
    if (err) {
        console.error(`Error: ${err.message}`);
        return;
    }

    config.HOST = addresses[0].split(":")
    config.EXTERN_PORT = parseInt(addresses[0].split(":").pop())
});

config.INTERN_PORT = parseInt(iniConfig.gossip.api_address.split(":").pop());


/**
 * The number of peers for the application.
 * @type {number}
 */
let numberOfPeers = 1;
let debug = true
// Parse command-line arguments to set configuration options
process.argv.slice(2).forEach((arg) => {
    const [key, value] = arg.split('=');
    if (key.startsWith('debug')) {
        debug = value === 'true'
    }
    if (key.startsWith('numberOfPeers') || key == `n`) {
        numberOfPeers = parseInt(value)
    } else if (key in defaultConfig) {
        if (typeof defaultConfig[key] === 'number') {
            config[key] = parseFloat(value);
        } else if (typeof defaultConfig[key] === 'boolean') {
            config[key] = value === 'true';
        } else {
            config[key] = value;
        }
    }
});

console.log(config)
console.log(`numberOfPeers: ${numberOfPeers}`)
/**
 * The custom configuration for the application.
 * @type {Config}
 */
const customConfig: Config = {
    INTERN_PORT: config.INTERN_PORT,
    EXTERN_PORT: config.EXTERN_PORT,
    DEBUG: debug,
}

/**
 * Represents the array of GossipServer instances.
 * @type {GossipServer[]}
 */
const servers: GossipServer[] = [
    new GossipServer({ ...config, ...customConfig }),
];

/**
 * Create additional GossipServer instances based on the number of peers.
 */
for (let i = 0; i < numberOfPeers - 1; i++) {
    customConfig.DEBUG = false;
    customConfig.INTERN_PORT = 7002 + i;
    customConfig.EXTERN_PORT = 4002 + i;

    const server = new GossipServer({ ...config, ...customConfig });
    servers.push(server);
}

// Uncomment the following code as needed and provide appropriate TypeDoc comments:

if (debug) {
    /**
     * Logs information about peers and unconnected peers.
     */
    setTimeout(() => {
        console.log(`PeersAdress:`)
        console.log(servers[0].getPeersAdress())
        console.log(`UnConnectedPeersAdress:`)
        console.log(servers[0].getUnConnectedPeersAdress())
    }, 10000)

    /**
     * Logs information about the cache at regular intervals.
     */
    setInterval(() => {
        console.log("cache")
        console.log(JSON.stringify(servers[0].getCachedMessages()))
    }, 5000)
}

