import GossipServer from "./GossIpServer";
// Import necessary libraries
import args from 'args';
import fs from 'fs';
import ini from 'ini';
import { set } from "lodash";


// TODO: import config from config.ini
// TODO: import config from Args


// // Define command-line options
// args.option('config', 'Path to the configuration file (-c)', 'config.ini');

// // Parse command-line arguments
// const flags = args.parse(process.argv);
// const configFile = flags.config;

// // Read and parse configuration
// const configData = fs.readFileSync(configFile, 'utf-8');
// const config = ini.parse(configData);

// // Extract relevant configuration parameters
// const databaseHost = config.database.host;
// const appTheme = config.app.theme;

// // Use configuration parameters in your module
// console.log(`Database Host: ${databaseHost}`);
// console.log(`App Theme: ${appTheme}`);

const servers = [
    new GossipServer({
        INTERN_PORT: 7001,
        EXTERN_PORT: 4001,
        DEBUG: true,
    }),
];

for (let i = 0; i < 45; i++) {
    const server = new GossipServer({
        INTERN_PORT: 7002 + i,
        EXTERN_PORT: 4002 + i,
        DEBUG: false,
    });
    servers.push(server);
}

servers.push( new GossipServer({
    INTERN_PORT: 7000,
    EXTERN_PORT: 4000,
    DEBUG: false,
}))
setTimeout (() => {
    console.log(servers[0].getPeers())
    console.log(servers[0].getUnConnectedPeers())
}, 5000)



