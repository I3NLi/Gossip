/* eslint-disable @typescript-eslint/no-unused-vars */

// Node.js core modules
import * as net from 'net';
import crypto, { createHash, generateKeyPairSync } from 'crypto';

// Third-party modules
import shuffle from 'lodash/shuffle';
import randomBytes from 'randombytes';
import { serialize, deserialize, BSONError } from 'bson';

// local modules
import MESSAGETYPE from './MessageType';
import { EncryptionType, Header, ChallengeType } from './TypeDefiniton';
import * as ExternProtocol from './ExternProtocol';
import {
  sign,
  verify,
  signWithKeyList,
  verifyWithKeyList,
  getVerifyData,
} from './Cryption';
import assert from 'assert';

export interface Config {
  INTERN_PORT: number;
  EXTERN_PORT: number;
  ENROLL_TIMEOUT: number;
  ENROLL_HARDNESS: number;
  HOST: string;
  MAX_SIZE_OF_PEERS: number;
  MAX_SIZE_OF_NEIGHBERS_TO_SHARE: number;
  ENCRYPTION_TYPE: EncryptionType;
  RETRY_DURATION: number;
  BOOTSTRAPPER: string;
  CACHE_SIZE: number;
  DEFAULT_TTL: number;
  DEBUG: boolean;
  COUNTER_RESET_DURATION: number;
  COUNTER_LIMIT: number;
  BLOCK_LIST_UPDATE_DURATION: number;
  BLOCK_LIST_REMOVAL_DURATION: number;
}

export const defaultConfig = {
  INTERN_PORT: 7001,
  EXTERN_PORT: 4001,
  ENROLL_TIMEOUT: 15000,
  ENROLL_HARDNESS: 1,
  HOST: '127.0.0.1',
  MAX_SIZE_OF_PEERS: 30,
  MAX_SIZE_OF_NEIGHBERS_TO_SHARE: 3,
  ENCRYPTION_TYPE: EncryptionType.RSA2048,
  RETRY_DURATION: 1000,
  BOOTSTRAPPER: `[::1]:4001`,
  CACHE_SIZE: 1000,
  DEFAULT_TTL: 10,
  DEBUG: true,
  COUNTER_RESET_DURATION: 1000,
  COUNTER_LIMIT: 100, //should be greater than MAX_SIZE_OF_PEERS
  BLOCK_LIST_UPDATE_DURATION: 1000,
  BLOCK_LIST_REMOVAL_DURATION: 1000 * 60 * 5,
}

type PublicKey = string
type PrivatKey = string
type Peer = { socket: net.Socket, serverAdress: string }

/**
 * Class representing a Gossip server.
 * @Class GossipServer 
 * @classdesc  A Gossip server is used for communication within a network of peers.
 * @constructor GossipServer
 * @property {string} id - The id of the server.
 * @property {Config} Config - The configuration object for the server.
 * @property {Object} Cache - The cache for storing messages.
 * @property {net.Server} InternServer - The internal server for communication within the module.
 * @property {net.Server} ExternServer - The external server for communication with peers.
 * @property {string} publicKey - The public key of the server.
 * @property {string} privateKey - The private key of the server.
 * @property {Object} blockList - The blocklist to keep track of blocked addresses.
 * @property {Object} messageCounters - The counters to track the number of messages sent by each peer.
 * @property {number} NetzBuildingClockId - The timer for periodic tasks.
 * @property {number} MessageCountersResetId - The timer for periodic tasks.
 * @property {number} BlackListResetClockId - The timer for periodic tasks.
 * @property {Object} Topics - The subscribed topics relation with socket.
 * @property {Object} Peers - The peers.
 * @property {Object} Challenges - The challenges.
 * @property {Object} UnConnectedPeers - The unconnected peers.
 * 
 */
export default class GossipServer {
  /* Shared */
  private id: string;
  // store the cache of the messages
  private Config: typeof defaultConfig = defaultConfig;
  // Cache for storing messages
  private Cache: { [messageTypeId: string]: ExternProtocol.GossipBordcast } = {};

  // Internal server for communication within the module
  private InternServer: net.Server;
  // External server for communication with peers
  private ExternServer: net.Server;


  // key for server identification
  private publicKey;
  private privateKey;

  // A blocklist to keep track of blocked addresses
  private blockList: { [address: string]: number } = {};
  // Counters to track the number of messages sent by each peer
  private messageCounters: { [publicKey: string]: number } = {};

  // Timers for periodic tasks
  private NetzBuildingClockId: ReturnType<typeof setTimeout> | undefined;
  private MessageCountersResetId: ReturnType<typeof setTimeout> | undefined;
  private BlackListResetClockId: ReturnType<typeof setTimeout> | undefined;

  /* Intern Only */
  // store the subscribed topics relation with socket
  private Topics: { [dataType: string]: net.Socket[] } = {};

  /* Extern Only */
  private Peers: { [publicKey: string]: Peer } = {};
  private Challenges: {
    [address: string]:
    { challenge: string, challengeType: ChallengeType, destroyClockId: ReturnType<typeof setTimeout>, socket: net.Socket, challengeHardness: number }
  } = {};
  private UnConnectedPeers: { [address: string]: PublicKey } = {};

  /**
   * Constructor for the GossipServer class.
   * @param config - The configuration object for the server.
   */
  constructor(config = {}) {
    this.Config = { ...defaultConfig, ...config };
    this.Config.HOST = this.Config.HOST.replace(/\[|\]/g, '')
    this.id = Math.random().toString(36).substring(2, 15)

    // Create internal and external servers
    this.InternServer = net.createServer();
    this.ExternServer = net.createServer();


    // Error handling for internal server
    this.InternServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${this.Config.INTERN_PORT} is already in use for internal connections.`);
      } else {
        console.error('An error occurred:', error);
      }
    });
    // Error handling for external server
    this.ExternServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${this.Config.EXTERN_PORT} is already in use for internal connections.`);
      } else {
        console.error('An error occurred:', error);
      }
    });

    // Set up event handlers for internal and external connections
    this.InternServer.on('connection', this.handleInternConnection.bind(this));
    this.ExternServer.on('connection', this.handleExternConnection.bind(this));


    // Listen on specified ports
    this.InternServer.listen(this.Config.INTERN_PORT, () => {
      this.printDebugInfo(`Internal server is listening on port ${this.Config.INTERN_PORT}`);
    });

    this.ExternServer.listen(this.Config.EXTERN_PORT, () => {
      this.printDebugInfo(`External server is listening on port ${this.Config.EXTERN_PORT}`);
    });


    this.printDebugInfo(`+++++++++++++++++++server started  +++++++++++++++++`)
    this.printDebugInfo(`internServer started at ${this.getServerAddress(this.InternServer)} `)
    this.printDebugInfo(`externServer started at ${this.getServerAddress(this.ExternServer)} `)


    // Generate RSA key pair
    if (this.Config.ENCRYPTION_TYPE === EncryptionType.RSA2048) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      this.publicKey = publicKey;
      this.privateKey = privateKey;
    }


    this.printDebugInfo(`Config: ${JSON.stringify(this.Config)}`)
    this.printDebugInfo(`Public Key: ${this.publicKey}`);
    this.printDebugInfo(`Private Key: ${this.privateKey}`);
    this.printDebugInfo('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')

    // Build Netz
    // wait for server started
    this.NetzBuildingClockId = setInterval(() => this.buildNetzConnection(), this.Config.RETRY_DURATION);
    // this.NetzBuildingClockId = setTimeout(() => this.buildNetzConnection(), this.Config.RETRY_DURATION);

    this.BlackListResetClockId = setInterval(() => this.updateBlockList(), this.Config.BLOCK_LIST_UPDATE_DURATION);
    this.MessageCountersResetId = setInterval(() => this.messageCounters = {}, this.Config.COUNTER_RESET_DURATION);
  }

  /** Intern Only */
  /**
   * Method to handle internal connections. The Route are also dispatched here.
   * @param socket - The Socket connection of the internal client.
   */
  private handleInternConnection(socket: net.Socket) {
    // Handle Connection from internal clients(other modules)
    this.printDebugInfo('New internClient connected from ' + this.getNetAddress(socket));

    socket.on('data', (data: Buffer) => {
      const { size, messageType } = this.getHeader(data);

      this.printDebugInfo(`Received data from intern Module: ${this.getNetAddress(socket)}`);


      this.printDebugInfo(`Message Size: ${size}`);
      this.printDebugInfo(`Message Type: ${messageType} ${MESSAGETYPE.getName(messageType.toString())}`);

      // Dispatch message to corresponding handler
      if (MESSAGETYPE.getName(messageType.toString()) === 'GOSSIP ANNOUNCE') {
        this.handleAnnounce(data);
      } else if (MESSAGETYPE.getName(messageType.toString()) === 'GOSSIP NOTIFY') {
        this.handleNotify(data, socket);
      } else if (MESSAGETYPE.getName(messageType.toString()) === 'GOSSIP VALIDATION') {
        this.handleValidation(data);
      }
    });

    // Remove the socket from the topics when the client disconnects
    socket.on('end', () => {
      this.printDebugInfo(`internClient ${this.getNetAddress(socket)} disconnected `);
      Object.keys(this.Topics).forEach((topic) => {
        const sockets = this.Topics[topic];

        for (let i = sockets.length - 1; i >= 0; i--) {
          if (sockets[i] === socket) {
            sockets.splice(i, 1);
          }
        }
      });
      this.printDebugInfo('Client disconnected');
    });

    // Handle errors
    socket.on('error', (err) => {
      console.error(err);
    });
  }
  /**
   * Handle announcement messages.
   * @param data - The received data.
   */
  private handleAnnounce(data: Buffer) {
    /** TODO: 
     * Message to instruct Gossip to spread the knowledge about given data item. It is sent from
     * other modules to the Gossip module. No return value or confirmation is sent by Gossip for
     * this message. The Gossip should put in its best effort to spread this information.
     * 
     * The TTL field specifies until how many hops the overlying application requires this data
     * to be spread. A value of 0 implies unlimited hops. The data type field specifies the type
     * of the application data. The data type should not be confused with the message type field:
     * While they are similar, message types are used to identify messages in the API protocols,
     * whereas the data type is used to identify the application data Gossip spreads in the network.
     * 
     * Since this message does not evoke a response from Gossip, no assumptions about successful
     * spreading of the data in the message can be made. Knowledge spreading is best effort and
     * can only be seen as probabilistic. However, with enough cache size and well connectivity, it
     * is very likely to achieve a good chance of knowledge spreading in the network.
     * 
     * */
    const ttl = data.readUIntBE(4, 1);
    const reserved = data.readUIntBE(5, 1);
    const dataType = data.readUInt16BE(6);
    const messageData = data.subarray(8);
    this.printDebugInfo(`TTL: ${ttl}`);
    this.printDebugInfo(`Reserved: ${reserved}`);
    this.printDebugInfo(`Data Type: ${dataType}`);
    this.printDebugInfo(`Message Data: ${messageData.toString()}`);
    this.printDebugInfo('\n');

    const messageDataBuffer = Buffer.from(messageData);
    const signature = sign(messageDataBuffer, this.privateKey!);
    const payload: ExternProtocol.GossipBordcast = {
      messageTypeId: 510,
      dataTypeId: dataType,
      messageId: createHash('sha256').update(messageData).digest('base64'),
      message: messageDataBuffer.toString(),
      keyList: [],
      ttl: this.Config.DEFAULT_TTL
    }

    // uncomment this block to test the reflcation of the message
    // const messageIdBuffer = Buffer.from(payload.messageId, 'base64');
    // assert(messageIdBuffer.length === 2, 'messageId should be 2 bytes');
    // const dataTypeBuffer = Buffer.alloc(2);
    // dataTypeBuffer.writeUInt16BE(dataType);

    // this.sendNotification(messageIdBuffer, dataTypeBuffer, messageData);

    this.broadcast(payload);
  }
  /**
   * Handle notification messages.
   * @param data - The received data.
   * @param socket - The client Socket connection.
   */
  private handleNotify(data: Buffer, socket: net.Socket) {
    /**
     * This message serves two purposes. Firstly, it is used to instruct Gossip to notify the module
     * sending this message when a new application data message of given type is received by it.
     * The new data message could have been received from another peer or by another module
     * of the local peer. The caller of this API will be notified by the Gossip through GOSSIP
     * NOTIFICATION messages (See Section 4.2.3). The data type field specifies which type of
     * messages the caller is interested in being notified.
     * The second purpose of this message is to tell Gossip which message types are valid and
     * hence should be propagated further. This means only messages for which a module has
     * registered a notification from Gossip will be propagated by Gossip. */

    const reserved = data.readUInt16BE(4);
    const dataType = data.readUInt16BE(6);
    if (this.Topics[dataType.toString()] === undefined) {
      this.Topics[dataType] = [];
    }

    if (this.Topics[dataType.toString()].includes(socket)) {
      console.error('Socket already in topic');
    } else {
      this.Topics[dataType].push(socket);
    }


    this.printDebugInfo(`Reserved: ${reserved}`);
    this.printDebugInfo(`Data Type: ${dataType}`);
    this.printDebugInfo(`Topics` + JSON.stringify(this.Topics))

  }

  /**
 * Package and send response to socket
 * @param socket - The target Socket connection.
 * @param messageType - The message type.
 * @param payload - The payload data.
 */
  private sendResponse(socket: net.Socket, messageType: number | string, payload: Buffer) {
    const size = Buffer.alloc(2);
    const messageTypeBuffer = Buffer.alloc(2);

    if (typeof messageType === 'string') {
      messageType = parseInt(messageType);
    }
    if (typeof messageType !== 'number') {
      throw new Error('messageType should not be message type name');
    }

    size.writeUInt16BE(payload.length + 16);
    messageTypeBuffer.writeUInt16BE(messageType);

    const response = Buffer.concat([size, messageTypeBuffer, payload]);
    socket.write(response);
  }

  /**
 * Get the message header.
 * @param data - The data buffer.
 * @returns The message header object.
 */
  private getHeader(data: Buffer): Header {
    const size = data.readUInt16BE(0);
    const messageType = data.readUInt16BE(2);
    return { size, messageType };
  }

  /** Extern Only */
  /**
 * Handles the connection of an external peer.
 * @param socket - The socket representing the connection to the peer.
 */
  private handleExternConnection(socket: net.Socket) {

    const address = this.getNetAddress(socket);
    this.printDebugInfo('New Peer connected from ' + address);
    this.sendChallenge(socket);

    socket.on('data', (data: Buffer) => {
      this.handleExternDataIncoming(data, socket);
    });


    socket.on('end', () => {
      this.printDebugInfo(`Peer ${address} disconnected`)
      this.removePeer(socket);
    });

    // Handle errors
    socket.on('error', (err) => {
      console.error(err);
    });
  }
  /**
   * Handles incoming data from an external peer.
   * @param data - The incoming data.
   * @param socket - The socket associated with the data.
   */
  private handleExternDataIncoming(data: Buffer, socket: net.Socket) {
    let incomingJsonData
    try { incomingJsonData = deserialize(data) } catch (e) {
      this.printDebugInfo(`deserialize error: ${e}`)
      this.removePeer(socket)
      return
    }


    this.printDebugInfo(``);
    this.printDebugInfo(`Received data from Peer: ${this.getNetAddress(socket)}`);
    this.printDebugInfo(`Message Type: ${incomingJsonData.messageTypeId} ${MESSAGETYPE.getName(incomingJsonData.messageTypeId.toString())}`);


    // Dispatch message to corresponding handler
    if (MESSAGETYPE.getName(incomingJsonData.messageTypeId.toString()) === 'GOSSIP ENROLL INIT') {
      return this.sendChallenge(socket);
    }
    if (MESSAGETYPE.getName(incomingJsonData.messageTypeId.toString()) === 'GOSSIP ENROLL CHALLENGE') {
      return this.solveChallenge(socket, incomingJsonData as ExternProtocol.GossipEnrollChallenge);
    }
    if (MESSAGETYPE.getName(incomingJsonData.messageTypeId.toString()) === 'GOSSIP ENROLL REGISTER') {
      return this.handleRegister(socket, incomingJsonData as ExternProtocol.GossipEnrollRegister);
    }
    if (MESSAGETYPE.getName(incomingJsonData.messageTypeId.toString()) === 'GOSSIP ENROLL SUCCESS') {
      return this.handleRegisterSuccess(socket, incomingJsonData as ExternProtocol.GossipEnrollSuccess);
    }
    if (MESSAGETYPE.getName(incomingJsonData.messageTypeId.toString()) === 'GOSSIP RESPONSE FAILURE') {
      return this.handleRegisterFailed(socket, incomingJsonData as ExternProtocol.GossipEnrollFailure);
    }
    if (MESSAGETYPE.getName(incomingJsonData.messageTypeId.toString()) === 'GOSSIP BORDCAST') {
      return this.handleBordcast(socket, incomingJsonData as ExternProtocol.GossipBordcast);
    }
  }
  /**
   * Builds network connections to peers based on configuration.
   */
  private buildNetzConnection() {
    if (Object.keys(this.Peers).length >= this.Config.MAX_SIZE_OF_PEERS) return;


    this.printDebugInfo(` +++++++++++++++++++buildNetzConnection+++++++++++++++++`)
    this.printDebugInfo(` UnConnectedPeers: ${JSON.stringify(Object.keys(this.UnConnectedPeers))}`)
    this.printDebugInfo(` Peer: ${JSON.stringify(this.getPeersAdress())}`)


    if (!Object.keys(this.UnConnectedPeers).length) {

      this.printDebugInfo(`No UnConnectedPeers, connect to BOOTSTRAPPER ${this.Config.BOOTSTRAPPER} after ${this.Config.RETRY_DURATION}ms`)
      this.connectToPeer(this.Config.BOOTSTRAPPER)

    } else {
      const countOfNewPeers = Math.min(this.Config.MAX_SIZE_OF_PEERS, Object.keys(this.Peers).length)
      const PerrsReadyToConnect = shuffle(Object.keys(this.UnConnectedPeers)).slice(0, countOfNewPeers);
      for (const peerAddress of PerrsReadyToConnect) {
        this.connectToPeer(peerAddress);
      }
    }


    this.printDebugInfo(` +++++++++++++++++StopBuildNetzConnection+++++++++++++++`)
    this.printDebugInfo(``)


  }
  /**
   * Connects to a specified peer address.
   * @param address - The address of the peer to connect to.
   */
  private connectToPeer(address: string = "") {
    if (this.getServerAddress(this.ExternServer) === address) {
      this.printDebugInfo(`cannot connect to it self: ${address}`);
      return;
    }

    for (const publicKey of Object.keys(this.Peers)) {
      if (this.Peers[publicKey].serverAdress === address) {
        this.printDebugInfo(`already connected to ${address}`);
        return;
      }
    }

    if (!address) {

      this.printDebugInfo(`No address provided, randomly select one from UnConnectedPeers`)

      const peerAddresses = Object.keys(this.UnConnectedPeers);
      address = shuffle(peerAddresses)[0];
    }


    this.printDebugInfo(`Connecting to peer at address: ${address}`);


    const addressGroup = address.split(':');
    const port = addressGroup.pop()
    const host = addressGroup.join(':');


    this.printDebugInfo(`connecting to ${host}:${port}`)


    const socket = net.createConnection(Number.parseInt(port as string), host, () => {
      this.printDebugInfo(`Connected to peer at address: ${address}`);
      socket.on('data', (data: Buffer) => {
        this.handleExternDataIncoming(data, socket);
      });

      socket.on('end', () => {
        this.printDebugInfo(`Peer ${address} disconnected`)
        delete this.Peers[this.getNetAddress(socket)];
      });

      socket.on('error', (err) => {
        this.printDebugInfo(`Peer ${address} error: ${err}`)
        delete this.UnConnectedPeers[address];
      })
    });
  }

  /**
   * Handles the registration of a peer.
   * @param socket - The socket representing the peer.
   * @param data - The registration data from the peer.
   */
  private handleRegister(socket: net.Socket, data: ExternProtocol.GossipEnrollRegister) {
    const address = this.getNetAddress(socket);
    this.printDebugInfo(`handleRegister: ${address}`)
    this.printDebugInfo(`handleRegister: ${JSON.stringify(data)}`)

    if (this.Challenges[address].challenge !== data.challenge) {
      this.printDebugInfo(`challenge is not valid`)
      this.sendRegisterFailed(socket, 'challenge did not match');
      socket.end();
      return
    }

    if (this.verifyChallenge(data, this.Challenges[address].challengeHardness)) {
      this.Peers[data.publicKey] = { socket: socket, serverAdress: data.serverAddress };
      clearTimeout(this.Challenges[address].destroyClockId);
      delete this.Challenges[address];
      this.sendRegisterSuccess(socket);
    } else {
      clearTimeout(this.Challenges[address].destroyClockId);
      this.sendRegisterFailed(socket, 'Challenge failed');
      socket.end();
    }
  }
  /**
   * Handles a successful registration response from a peer.
   * @param socket - The socket representing the peer.
   * @param data - The registration success data from the peer.
   */
  private handleRegisterSuccess(socket: net.Socket, data: ExternProtocol.GossipEnrollSuccess) {

    this.printDebugInfo(`handleRegisterSuccess: ${this.getNetAddress(socket)}`)
    this.printDebugInfo(`handleRegisterSuccess: ${JSON.stringify(data)}`)


    // store peer
    this.Peers[data.publicKey] = { socket: socket, serverAdress: this.getNetAddress(socket) };


    // remove peer from unconnected peers
    delete this.UnConnectedPeers[this.getNetAddress(socket)];


    this.printDebugInfo(`add ${this.getNetAddress(socket)} to peer:`)
    this.printDebugInfo(`${JSON.stringify(this.Peers)}`)


    // add new unconnected peers
    data.neighbours.forEach((neighbour) => {
      this.UnConnectedPeers[neighbour.address] = neighbour.publicKey;
    })


    this.printDebugInfo(`add new unconnected peers: ${JSON.stringify(data.neighbours)}`)
    this.printDebugInfo(`unconnected peers: ${JSON.stringify(this.UnConnectedPeers)}`)

    // if (this.Config.DEBUG) {
    //   this.printDebugInfo(`Peer ${JSON.stringify(this.Peers)}`)
    //   this.printDebugInfo(`UnConnectedPeers ${JSON.stringify(this.UnConnectedPeers)}`)
    //   this.printDebugInfo(`build netz connection`)
    // }
    // this.buildNetzConnection();
  }
  /**
   * Handles a failed registration response from a peer.
   * @param socket - The socket representing the peer.
   * @param data - The registration failure data from the peer.
   */
  private handleRegisterFailed(socket: net.Socket, data: ExternProtocol.GossipEnrollFailure) {
    this.printDebugInfo(`handleRegisterFailed: ${this.getNetAddress(socket)}`)
    delete this.UnConnectedPeers[this.getNetAddress(socket)];
  }
  /**
   * Handles a broadcast message received from a peer.
   * @param socket - The socket representing the peer.
   * @param data - The broadcast message data.
   */
  private handleBordcast(socket: net.Socket, data: ExternProtocol.GossipBordcast) {

    this.printDebugInfo(`handleBordcast from: ${this.getNetAddress(socket)}`)
    this.printDebugInfo(`handleBordcast: ${JSON.stringify(data)}`)


    // if (this.Cache[data.messageId]) return; // donot broadcast again

    const message = getVerifyData(Buffer.from(data.message, 'base64'), data.keyList)
    if (message === undefined || createHash('sha256').update(message.toString()).digest('base64') !== data.messageId) {
      this.printDebugInfo(`message is not valid`)
      this.blockPeer(data.keyList)
      return
    }

    if (this.updataMessageCounter(data.keyList)) {
      this.printDebugInfo(`message counter is too high`)
      this.blockPeer(data.keyList)
      return
    }

    this.printDebugInfo(`message: ${message.toString()}`)

    if (this.isIncludedInBlockList(data.keyList)) {
      this.printDebugInfo(`message is in block list`)
      // this.blockPeer(data.keyList)
      return
    }

    if (this.Cache[data.messageId]) {
      this.printDebugInfo(`message ${data.messageId} already broadcasted`)
      return; // donot broadcast again
    }
    // store message in cache
    const keysOfCache = Object.keys(this.Cache)
    if (this.Config.CACHE_SIZE < keysOfCache.length) {
      delete this.Cache[keysOfCache[0]];
      this.Cache[data.messageId] = data;
    }

    const messageIdBuffer = Buffer.from(data.messageId, 'base64').subarray(0, 2);
    assert(messageIdBuffer.length === 2, 'messageId should be 2 bytes');
    const dataTypeBuffer = Buffer.alloc(2);
    dataTypeBuffer.writeUInt16BE(data.dataTypeId);

    this.sendNotification(messageIdBuffer, dataTypeBuffer, Buffer.from(message));
    this.broadcast(data);
    // TODO: send notification to other modules
  }
  /**
   * Sends a challenge to an external peer during enrollment.
   * @param socket - The socket representing the peer.
   */
  private sendChallenge(socket: net.Socket) {

    const address = this.getNetAddress(socket);
    const challenge = randomBytes(64);
    const blockListLength = Object.keys(this.blockList).length ? Object.keys(this.blockList).length : 1;
    const challengeHardness = this.Config.ENROLL_HARDNESS + Math.floor(blockListLength ** -2); //dynamic hardness based on block list

    this.printDebugInfo(`challengeHardness to ${blockListLength}`)
    assert(challengeHardness > 0, 'challengeHardness should be greater than 0')
    assert(challengeHardness < 255, 'challengeHardness should be less than 255')



    //set timeout to destroy socket
    const destroyClockId = setTimeout(() => {
      this.printDebugInfo(`Enroll timeout, destroy socket ${address}`);
      socket.end();
    }, this.Config.ENROLL_TIMEOUT);

    //store challenge
    this.Challenges[address] = {
      challenge: challenge.toString('base64'),
      challengeType: ChallengeType.SHA256_6,
      destroyClockId: destroyClockId,
      socket: socket,
      challengeHardness: challengeHardness
    }

    const payload: ExternProtocol.GossipEnrollChallenge = {
      messageTypeId: 506,
      challengeType: ChallengeType.SHA256_6,
      challengeHardness: challengeHardness, //dynamic hardness based on block list
      challenge: challenge.toString('base64'),
      publicKey: this.publicKey!
    }
    socket.write(serialize(payload))


    this.printDebugInfo(`sendChallenge to ${this.getNetAddress(socket)}`)

  }
  /**
   * Sends a successful registration response to a peer.
   * @param socket - The socket representing the peer.
   */
  private sendRegisterSuccess(socket: net.Socket) {
    const sizeOfNeighbers = Object.keys(this.Peers).length;
    let sizeOfNeighbersToShare: number = sizeOfNeighbers / 2;
    sizeOfNeighbersToShare = Math.min(sizeOfNeighbersToShare, this.Config.MAX_SIZE_OF_NEIGHBERS_TO_SHARE);

    const neighbours = shuffle(Object.keys(this.Peers)).slice(0, sizeOfNeighbersToShare).map((publicKey) => {
      return {
        address: this.Peers[publicKey].serverAdress,
        publicKey: publicKey
      }
    })

    const payload: ExternProtocol.GossipEnrollSuccess = {
      messageTypeId: 508,
      publicKey: this.publicKey!,
      neighbours: neighbours
    }

    socket.write(serialize(payload))


    this.printDebugInfo(`sendRegisterSuccess to ${this.getNetAddress(socket)}`)
    this.printDebugInfo(`sendRegisterSuccess: ${JSON.stringify(payload)}`)

  }
  /**
   * Sends a registration failure response to a peer.
   * @param socket - The socket representing the peer.
   * @param errorMassage - The error message to send.
   */
  private sendRegisterFailed(socket: net.Socket, errorMassage: string) {
    const payload: ExternProtocol.GossipEnrollFailure = {
      messageTypeId: 509,
      errorMessage: errorMassage
    }
    socket.write(serialize(payload))

    this.printDebugInfo(`sendRegisterFailed to ${this.getNetAddress(socket)}`)
    this.printDebugInfo(`sendRegisterFailed: ${JSON.stringify(payload)}`)

  }
  /**
   * Solves a challenge received from an external peer during enrollment.
   * @param socket - The socket representing the peer.
   * @param data - The challenge data received from the peer.
   */
  private solveChallenge(socket: net.Socket, data: ExternProtocol.GossipEnrollChallenge) {
    let payload: ExternProtocol.GossipEnrollRegister;
    assert(data.challengeHardness > 0, 'challengeHardness should be greater than 0')

    this.printDebugInfo(`solveingChallenge from:${this.getNetAddress(socket)}`)

    do {
      const nonce = randomBytes(64);
      payload = {
        messageTypeId: 507,
        challenge: data.challenge, //64 bytes Buffer in Base64
        nonce: nonce.toString("base64"), //64 bytes Buffer in Base64
        publicKey: this.publicKey!, //PEM
        serverAddress: this.getServerAddress(this.ExternServer)
      };
    } while (!this.verifyChallenge(payload, data.challengeHardness))


    this.printDebugInfo(`Challenge solved from: ${this.getNetAddress(socket)}`)
    // this.printDebugInfo(`solvedChallenge: ${JSON.stringify(payload)}`)


    socket.write(serialize(payload))
  }
  /**
   * Verifies a challenge during the enrollment process.
   * @param payload - The enrollment payload containing challenge data.
   * @returns True if the challenge is successfully verified; otherwise, false.
   */
  private verifyChallenge(payload: ExternProtocol.GossipEnrollRegister, challengeHardness: number): boolean {
    assert(challengeHardness > 0, 'challengeHardness should be greater than 0')
    const challenge = Array(challengeHardness).fill('0').join('')
    const sha256 = createHash('sha256').update(serialize(payload)).digest('hex');

    this.printDebugInfo(`verifyChallenge: ${sha256}`)

    return sha256.startsWith(challenge);
  }
  /**
   * Updates message counters for the specified public keys and checks if they exceed the limit.
   * @param publicKeys - An array of public keys to update counters for.
   * @returns True if any of the public keys' counters exceed the limit; otherwise, false.
   */
  private updataMessageCounter(publicKeys: string[]): boolean {
    this.printDebugInfo(`updataMessageCounter: ${JSON.stringify(publicKeys)}`)
    let exceedeLimit = false;
    publicKeys.forEach((key) => {
      if (this.messageCounters[key] === undefined) {
        this.messageCounters[key] = 0;
      }
      this.messageCounters[key]++;
      if (this.messageCounters[key] > this.Config.COUNTER_LIMIT) {
        exceedeLimit = true;
      }
    })
    return exceedeLimit;
  }
  /**
   * Blocks communication with peers identified by their public keys.
   * @param publicKey - An array of public keys to block.
   */
  private blockPeer(publicKey: string[]) {
    this.printDebugInfo(`blockPeer: ${JSON.stringify(publicKey)}`)
    publicKey.forEach((key) => {
      this.blockList[key] = Date.now();
    });
  }

  /** Shared */
  /**
 * Broadcasts a gossip message to connected peers.
 * @param payload - The gossip message to broadcast.
 */
  private broadcast(payload: ExternProtocol.GossipBordcast) {

    this.printDebugInfo(`broadcast message ${payload.messageId}`)
    if (this.Cache[payload.messageId] !== undefined) {
      this.printDebugInfo(`message ${payload.messageId} already broadcasted`)
      return;
    }

    this.Cache[payload.messageId] = payload;

    this.printDebugInfo(`Cache: ${JSON.stringify(payload)}`)

    this.Cache[payload.messageId] = payload;

    const newMessage = signWithKeyList(Buffer.from(payload.message), [this.privateKey!])
    const signature = sign(Buffer.from(payload.message, 'base64'), this.privateKey!)
    // build broadcast message
    const newPayload: ExternProtocol.GossipBordcast = {
      messageTypeId: 510,
      dataTypeId: payload.dataTypeId,
      messageId: payload.messageId,
      message: Buffer.from(serialize({ data: payload.message, signature: signature.toString('base64') })).toString("base64"),
      keyList: [...payload.keyList, this.publicKey!],
      ttl: payload.ttl - 1
    }
    const payloadBuffer = serialize(newPayload);

    this.printDebugInfo(`broadcast: ${JSON.stringify(newPayload)}`)

    Object.keys(this.Peers).forEach((publicKey) => {
      this.Peers[publicKey].socket.write(payloadBuffer);
      this.printDebugInfo(`broadcast to ${this.Peers[publicKey].serverAdress}`)
    });

  }

  /**
 * Removes a peer from the list of connected peers.
 * @param socket - The socket of the peer to be removed.
 */
  private removePeer(socket: net.Socket) {
    this.printDebugInfo(`removePeer: ${this.getNetAddress(socket)}`)
    for (const publicKey of Object.keys(this.Peers)) {
      if (this.Peers[publicKey].socket === socket) {
        delete this.Peers[publicKey];
      }
    }
    socket.end();
  }
  /**
   * Sends a notification message to modules interested in a specific data type.
   * @param messageID - The ID of the notification message.
   * @param dataType - The data type of the message.
   * @param data - The message data.
   */
  private sendNotification(messageID: Buffer, dataType: Buffer, data: Buffer) {
    /** TODO:
     * This message is sent by Gossip to the module which has previously asked Gossip to notify
     * when a message of a particular data type is received by Gossip. The receiver should have
     * previously conveyed its interest using GOSSIP NOTIFY message.
     * Message ID is a random number to identify this message and its corresponding response.
     * 
     * The module receiving this message has to reply with GOSSIP VALIDATION message to
     * signify whether this message is well-formed or not. Well-formedness of a message could be
     * defined as whether the mesage’s data is according to the expected format, its fields make
     * sense, any digital signatures in it verify OK or not. Gossip then propagates this message to
     * other peers if it is well-formed.
     * 
     */
    this.printDebugInfo(`sending Notification: ${messageID}`)

    assert(messageID.length === 2, 'messageID should be 2 bytes');
    assert(dataType.length === 2, 'dataType should be 2 bytes');

    const payload = Buffer.concat([messageID, dataType, data]);


    this.printDebugInfo(`messageID: ${messageID.toString("hex")}`)
    this.printDebugInfo(`dataType: ${dataType.readUInt16BE().toString()}`)
    this.printDebugInfo(`data: ${data.toString()}`)
    this.printDebugInfo(`this.Topics: ${JSON.stringify(this.Topics)}`)
    const topic = this.Topics[dataType.readUInt16BE().toString()] as net.Socket[]
    this.printDebugInfo(`topic: ${JSON.stringify(topic)}`)

    if (topic === undefined) return;

    topic.forEach((socket) => {
      this.printDebugInfo(`send Notification to ${this.getNetAddress(socket)}`)
      this.sendResponse(socket, 502, payload);
    })

  }
  /**
   * Handles the validation of a notification message.
   * @param data - The data of the validation message.
   */
  private handleValidation(data: Buffer) {
    /** 
     * The message is used to tell Gossip whether the GOSSIP NOTIFICATION with the given message ID 
     * is well-formed or not. The bitfield V, if set signifies the the notification is wellformed; 
     * otherwise it is to be deemed invalid and hence should not be propagated further.
     */
    const messageID = data.readInt16BE(4);
    const reserved = data.readInt16BE(6);
    const valid = reserved & 0x01;

    this.printDebugInfo(`messageID: ${messageID}`);
    this.printDebugInfo(`reserved: ${reserved}`);
    this.printDebugInfo(`valid: ${valid}`);

    if (valid) {

      this.printDebugInfo(`Message ${messageID} is valid`);

      // this.broadcast(messageID.toString("base64"));
    } else {

      this.printDebugInfo(`Message ${messageID} is valid`);


      // this.handleErrorMesssage(messageID);
    }

  }
  /**
   * Retrieves the network address of a socket.
   * @param socket - The socket for which the address is retrieved.
   * @returns The network address of the socket.
   */
  private getNetAddress(socket: net.Socket) {
    return socket.remoteAddress + ':' + socket.remotePort;
  }
  /**
   * Retrieves the server address of a given server.
   * @param server - The server for which the address is retrieved.
   * @returns The server address.
   */
  private getServerAddress(server: net.Server) {
    const address = server.address() as net.AddressInfo;
    return this.Config.HOST + ':' + address.port;
  }
  /**
   * Prints debug information if debugging is enabled in the configuration.
   * @param info - The debug information to print.
   */
  private printDebugInfo(info: string) {
    if (this.Config.DEBUG) {
      console.log(info);
    }
  }
  /**
   * Updates the block list by removing expired entries.
   */
  private updateBlockList() {
    const now = Date.now();
    Object.keys(this.blockList).forEach((key) => {
      this.blockList[key] -= this.Config.BLOCK_LIST_REMOVAL_DURATION;
      if (this.blockList[key] < 0) {
        delete this.blockList[key];
      }
    })
  }
  /**
   * Checks if any of the given public keys are included in the block list.
   * @param publicKeys - An array of public keys to check.
   * @returns True if any of the public keys are in the block list; otherwise, false.
   */
  private isIncludedInBlockList(publicKeys: string[]): boolean {
    for (const key of publicKeys) {
      if (this.blockList[key] !== undefined) {
        return true;
      }
    }
    return false;
  }

  /** Public API */
  /**
 * Sets the configuration for the GossipServer instance.
 * @param config - The configuration object to set.
 */
  public setConfig(config: typeof defaultConfig) { this.Config = { ...this.Config, ...config }; }
  /**
 * Gets a copy of the current configuration settings.
 * @returns A copy of the current configuration settings.
 */
  public getConfig() { return { ...this.Config } }
  /**
 * Gets a copy of the message counters.
 * @returns A copy of the message counters.
 */
  public getMassageCounters() { return { ...this.messageCounters } }
  /**
 * Gets a copy of the blocklist containing blocked addresses.
 * @returns A copy of the blocklist.
 */
  public getBlockList() { return { ...this.blockList } }
  /**
 * Gets the public and private keys of the server.
 * @returns An object containing the public and private keys.
 */
  public getKeys() { return { publicKey: this.publicKey, privateKey: this.privateKey } }
  /**
 * Gets a copy of the connected peers.
 * @returns A copy of the connected peers.
 */
  public getPeers() { return { ...this.Peers } }
  /**
 * Gets a copy of the unconnected peers.
 * @returns A copy of the unconnected peers.
 */
  public getUnConnectedPeers() { return { ...this.UnConnectedPeers } }
  /**
 * Gets the server addresses of the connected peers.
 * @returns An array of server addresses of connected peers.
 */
  public getPeersAdress() {
    const peersAdress: string[] = []
    for (const publicKey of Object.keys(this.Peers)) {
      peersAdress.push(this.Peers[publicKey].serverAdress)
    }
    return peersAdress
  }
  /**
 * Gets the server addresses of the unconnected peers.
 * @returns An array of server addresses of unconnected peers.
 */
  public getUnConnectedPeersAdress() { return Object.keys(this.UnConnectedPeers) }
  /**
 * Gets a copy of the cached messages.
 * @returns A copy of the cached messages.
 */
  public getCachedMessages() { return { ...this.Cache } }
}
