import  GossIpServer from './GossIpServer.mjs'
const port = 7001;
const server = new GossIpServer();

server.start(port);