import GossipServer from "./GossIpServer";
// Import necessary libraries
import args from 'args';
import fs from 'fs';
import ini from 'ini';


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

const server = new GossipServer(7001, 4000);
