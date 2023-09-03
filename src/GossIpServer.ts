/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Node.js 核心模块
import * as net from 'net';
import crypto, { createHash, generateKeyPairSync } from 'crypto';

// 第三方库
import shuffle from 'lodash/shuffle';
import randomBytes from 'randombytes';
import { serialize, deserialize, BSONError } from 'bson';

// 本地模块
import MESSAGETYPE from './MessageType';
import { add } from 'lodash';
import { EncryptionType, Header, ChallengeType } from './TypeDefiniton';
import * as ExternProtocol from './ExternProtocol';
import {
  sign,
  verify,
  signWithKeyList,
  verifyWithKeyList,
  getVerifyData,
} from './Cryption';

/**.ini */
const defaultConfig = {
  INTERN_PORT: 7001,
  EXTERN_PORT: 4002,
  ENROLL_TIMEOUT: 15000,
  ENROLL_HARDNESS: 1,
  MAX_SIZE_OF_NEIGHBERS_TO_SHARE: 3,
  ENCRYPTION_TYPE: EncryptionType.RSA2048,
  RETRY_DURATION: 1000,
  bootstrapper: `localhost:4002`,
  CACHE_SIZE: 1000,
  DEFAULT_TTL: 10,
  DEBUG: true,
}

type publicKey = string;
export default class GossipServer {
  /* Shared */
  private id: string;
  // store the cache of the messages
  private Config: typeof defaultConfig = defaultConfig;
  // Cache for messages
  private Cache: { [messageTypeId: string]: ExternProtocol.GossipBordcast } = {};

  private InternServer: net.Server;
  private ExternServer: net.Server;


  private publicKey;
  private privateKey;

  /* Intern Only */
  // store the subscribed topics relation with socket
  private Topics: { [dataType: string]: net.Socket[] } = {};

  /* Extern Only */
  private Peers: { [address: string]: { socket: net.Socket, publicKey: string } } = {};
  private Challenges: {
    [address: string]:
    { challenge: string, challengeType: ChallengeType, destroyClockId: ReturnType<typeof setTimeout>, socket: net.Socket }
  } = {};
  private UnConnectedPeers: { [address: string]: publicKey } = {};

  constructor(config = {}) {
    this.Config = { ...defaultConfig, ...config };

    this.id = Math.random().toString(36).substring(2, 15)
    if (this.Config.DEBUG) {
      console.log(`+++++++++++++++++++server started  +++++++++++++++++`)
      console.log(`internServer started at ${this.Config.INTERN_PORT} `)
      console.log(`externServer started at ${this.Config.EXTERN_PORT} `)
    }

    // Create internal and external servers
    this.InternServer = net.createServer();
    this.ExternServer = net.createServer();

    this.InternServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${this.Config.INTERN_PORT} is already in use for internal connections.`);
      } else {
        console.error('An error occurred:', error);
      }
    });

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
      console.log(`Internal server is listening on port ${this.Config.INTERN_PORT}`);
    });

    this.ExternServer.listen(this.Config.EXTERN_PORT, () => {
      console.log(`External server is listening on port ${this.Config.EXTERN_PORT}`);
    });

    console.log('GossipServer created');

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

    if (this.Config.DEBUG) {
      console.log(`Config: ${JSON.stringify(this.Config)}`)
      console.log(`Public Key: ${this.publicKey}`);
      console.log(`Private Key: ${this.privateKey}`);
      console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
    }
    // Build Netz
    // wait for server started
    setTimeout(() => this.buildNetzConnection(), 1000);
  }

  /** Intern Only */
  /**
 * Method to handle internal connections. The Route are also dispatched here.
 * @param socket - The Socket connection of the internal client.
 */
  private handleInternConnection(socket: net.Socket) {
    // Handle Connection from internal clients(other modules)
    console.log('New internClient connected from ' + this.getNetAddresses(socket));

    socket.on('data', (data: Buffer) => {
      const { size, messageType } = this.getHeader(data);

      console.log(`Received data from internClient client: ${this.getNetAddresses(socket)}`);

      if (this.Config.DEBUG) {
        console.log(`Message Size: ${size}`);
        console.log(`Message Type: ${messageType} ${MESSAGETYPE.getName(messageType.toString())}`);
      }
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
      console.log(`internClient ${this.getNetAddresses(socket)} disconnected `);
      Object.keys(this.Topics).forEach((topic) => {
        const index = this.Topics[topic].findIndex((client) => client === socket);
        if (index !== -1) {
          this.Topics[topic].splice(index, 1);
        }
      });
      console.log('Client disconnected');
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
    console.log(`TTL: ${ttl}`);
    console.log(`Reserved: ${reserved}`);
    console.log(`Data Type: ${dataType}`);
    console.log(`Message Data: ${messageData.toString()}`);
    console.log('\n');

    const payload: ExternProtocol.GossipBordcast = {
      messageTypeId: 510,
      messageId: createHash('sha256').update(messageData).digest('base64'),
      message: messageData.toString('base64'),
      keyList: [],
      ttl: this.Config.DEFAULT_TTL
    }

    this.Cache[payload.messageId] = payload;
    this.broadcast(payload.messageId);
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
    if (this.Topics[dataType] === undefined) {
      this.Topics[dataType] = [];
    }

    if (this.Topics[dataType].includes(socket)) {
      console.error('Socket already in topic');
    } else {
      this.Topics[dataType].push(socket);
    }
    console.log(`Reserved: ${reserved}`);
    console.log(`Data Type: ${dataType}`);
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
  private handleExternConnection(socket: net.Socket) {

    const address = this.getNetAddresses(socket);
    console.log('New Extren connected from ' + address);


    this.sendChallenge(socket);


    socket.on('data', (data: Buffer) => {
      this.handleExternDataIncoming(data, socket);
    });

    // Remove the socket from the topics when the client disconnects
    socket.on('end', () => {
      console.log(`internClient ${this.getNetAddresses(socket)} disconnected `);
      Object.keys(this.Topics).forEach((topic) => {
        const index = this.Topics[topic].findIndex((client) => client === socket);
        if (index !== -1) {
          this.Topics[topic].splice(index, 1);
        }
      });
      console.log('Client disconnected');
    });

    // Handle errors
    socket.on('error', (err) => {
      console.error(err);
    });
  }

  private handleExternDataIncoming(data: Buffer, socket: net.Socket) {
    const incomingJsonData = deserialize(data)

    console.log(``);
    console.log(`Received data from ExternClient client: ${data}`);
    console.log(`Message Type: ${incomingJsonData.messageTypeId} ${MESSAGETYPE.getName(incomingJsonData.messageTypeId.toString())}`);

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
      // return this.handleBordcast(socket, incomingJsonData as ExternProtocol.GossipBordcast);
    }
  }
  private buildNetzConnection() {
    const functionInstanceId = Math.random().toString(36).substring(2, 15)
    if (this.Config.DEBUG) {
      console.log(`${functionInstanceId} +++++++++++++++++++buildNetzConnection+++++++++++++++++`)
      console.log(`${functionInstanceId} UnConnectedPeers: ${JSON.stringify(this.UnConnectedPeers)}`)
      console.log(`${functionInstanceId} Peer: ${JSON.stringify(this.Peers)}`)

    }
    if (!Object.keys(this.UnConnectedPeers).length) {
      if (this.Config.DEBUG) {
        console.log(`No UnConnectedPeers, connect to bootstrapper ${this.Config.bootstrapper} after ${this.Config.RETRY_DURATION}ms`)
      }
      setTimeout(() => this.connectToPeer(this.Config.bootstrapper), this.Config.RETRY_DURATION);
    } else {
      while (Object.keys(this.Peers).length < this.Config.MAX_SIZE_OF_NEIGHBERS_TO_SHARE) {
        this.connectToPeer();
      }
    }
    console.log(`${functionInstanceId} ++++++++++++++++***buildNetzConnection***++++++++++++++`)

  }
  private connectToPeer(address: string = "") {
    if (Object.keys(this.UnConnectedPeers).includes(address)) {
      console.log(`Peer ${address} already connected`)
    }

    if (!address) {
      if (this.Config.DEBUG) {
        console.log(`No address provided, randomly select one from UnConnectedPeers`)
      }
      const peerAddresses = Object.keys(this.UnConnectedPeers);
      address = shuffle(peerAddresses)[0];
    }

    if (this.Config.DEBUG) {
      console.log(`Connecting to peer at address: ${address}`);
    }

    const [host, port] = address.split(':');
    const socket = net.createConnection(Number.parseInt(port), host, () => {
      console.log(`Connected to peer at address: ${address}`);
      socket.on('data', (data: Buffer) => {
        this.handleExternDataIncoming(data, socket);
      });

      socket.on('end', () => {
        if (this.Config.DEBUG) { console.log(`Peer ${address} disconnected`) }
        delete this.Peers[this.getNetAddresses(socket)];
      });
    });
  }


  private handleRegister(socket: net.Socket, data: ExternProtocol.GossipEnrollRegister) {

    const address = this.getNetAddresses(socket);

    if (this.verifyChallenge(data)) {
      this.Peers[this.getNetAddresses(socket)] = { socket: socket, publicKey: data.publicKey };
      clearTimeout(this.Challenges[address].destroyClockId);
      delete this.Challenges[address];
      this.sendRegisterSuccess(socket);
    } else {
      clearTimeout(this.Challenges[address].destroyClockId);
      this.sendRegisterFailed(socket, 'Challenge failed');
      socket.end();
    }
  }

  private handleRegisterSuccess(socket: net.Socket, data: ExternProtocol.GossipEnrollSuccess) {
    if (this.Config.DEBUG) {
      console.log(`handleRegisterSuccess: ${JSON.stringify(data)}`)
    }

    this.Peers[this.getNetAddresses(socket)] = { socket: socket, publicKey: data.publicKey };

    delete this.UnConnectedPeers[this.getNetAddresses(socket)];
    data.neighbours.forEach((neighbour) => {
      this.UnConnectedPeers[neighbour.address] = neighbour.publicKey;
    })

    if (this.Config.DEBUG) {
      console.log(`Peer ${JSON.stringify(this.Peers)}`)
      console.log(`UnConnectedPeers ${JSON.stringify(this.UnConnectedPeers)}`)
    }
    this.buildNetzConnection();
  }

  private handleRegisterFailed(socket: net.Socket, data: ExternProtocol.GossipEnrollFailure) {
    console.error(data.errorMassage);
    // throw new Error(data.errorMassage);
  }

  private handleBordcast(socket: net.Socket, data: ExternProtocol.GossipBordcast) {
    if (!this.Cache[data.messageId]) {
      throw new Error('Message ID invalid')
    }
    if (this.Cache[data.messageId]) return; // donot boradcast again

    const message = getVerifyData(Buffer.from(data.message, 'base64'), data.keyList);
    if (message === undefined) {
      throw new Error('Message verification failed')
    }

    // store message in cache
    const keysOfCache = Object.keys(this.Cache)
    if (this.Config.CACHE_SIZE < keysOfCache.length) {
      delete this.Cache[keysOfCache[0]];
      this.Cache[data.messageId] = data;
    }

    // send notification
    this.sendNotification(Buffer.from(data.messageId, "base64"), Buffer.from(data.message, 'base64'), message);

  }
  private sendChallenge(socket: net.Socket) {
    const address = this.getNetAddresses(socket);
    const challenge = randomBytes(64);

    //set timeout to destroy socket
    const destroyClockId = setTimeout(() => {
      console.log(`Enroll timeout, destroy socket ${address}`);
      socket.end();
    }, this.Config.ENROLL_TIMEOUT);

    //store challenge
    this.Challenges[address] = {
      challenge: challenge.toString('base64'),
      challengeType: ChallengeType.SHA256_6,
      destroyClockId: destroyClockId,
      socket: socket
    }

    const payload: ExternProtocol.GossipEnrollChallenge = {
      messageTypeId: 506,
      challengeType: ChallengeType.SHA256_6,
      challenge: challenge.toString('base64')
    }
    socket.write(serialize(payload))

    console.log(`Send challenge to ${address}`);
  }

  private sendRegisterSuccess(socket: net.Socket) {
    const sizeOfNeighbers = Object.keys(this.Peers).length;
    let sizeOfNeighbersToShare: number = sizeOfNeighbers / 2;
    sizeOfNeighbersToShare = Math.min(sizeOfNeighbersToShare, this.Config.MAX_SIZE_OF_NEIGHBERS_TO_SHARE);

    const neighbours = shuffle(Object.keys(this.Peers)).slice(0, sizeOfNeighbersToShare).map((address) => {
      return {
        address: this.getNetAddresses(this.Peers[address].socket),
        publicKey: this.Peers[address].publicKey
      }
    })

    const payload: ExternProtocol.GossipEnrollSuccess = {
      messageTypeId: 508,
      publicKey: this.publicKey!,
      neighbours: neighbours
    }

    socket.write(serialize(payload))
  }

  private sendRegisterFailed(socket: net.Socket, errorMassage: string) {
    const payload: ExternProtocol.GossipEnrollFailure = {
      messageTypeId: 509,
      errorMassage: errorMassage
    }
    socket.write(serialize(payload))
  }

  private solveChallenge(socket: net.Socket, data: ExternProtocol.GossipEnrollChallenge) {
    let payload: ExternProtocol.GossipEnrollRegister;

    if (this.Config.DEBUG) {
      console.log(`solveingChallenge: ${JSON.stringify(data)}`)
    }
    do {
      const nonce = randomBytes(64);
      payload = {
        messageTypeId: 507,
        challenge: data.challenge, //64 bytes Buffer in Base64
        nonce: nonce.toString("base64"), //64 bytes Buffer in Base64
        publicKey: this.publicKey! //PEM
      };
    } while (!this.verifyChallenge(payload))

    if (this.Config.DEBUG) {
      console.log(`solvedChallenge: ${JSON.stringify(payload)}`)
    }
    socket.write(serialize(payload))
  }

  private verifyChallenge(payload: ExternProtocol.GossipEnrollRegister): boolean {
    const challenge = Array(this.Config.ENROLL_HARDNESS).fill('0').join('')
    const sha256 = createHash('sha256').update(serialize(payload)).digest('hex');
    if (this.Config.DEBUG) {
      console.log(`verifyChallenge: ${sha256}`)
    }
    return sha256.startsWith(challenge);
  }


  /** Shared */


  private broadcast(messageId: string) {
    if (this.Cache[messageId] !== undefined) {
      return;
    }

    const data = this.Cache[messageId];
    const newMessage = signWithKeyList(Buffer.from(data.message), [this.privateKey!])
    // build broadcast message
    const payload: ExternProtocol.GossipBordcast = {
      messageTypeId: 510,
      messageId: data.messageId,
      message: Buffer.from(newMessage).toString("base64"),
      keyList: [...data.keyList, this.publicKey!],
      ttl: data.ttl - 1
    }
    const payloadBuffer = serialize(payload);

    Object.keys(this.Peers).forEach((address) => {
      this.Peers[address].socket.write(payloadBuffer);
    });
  }


  private removeClient(socket: net.Socket) {

  }

  private handleErrorMesssage(messageID: Buffer) { }

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
    const payload = Buffer.concat([messageID, dataType, data]);

    this.Topics[dataType.toString()].forEach((socket) => {
      this.sendResponse(socket, 502, payload);
      socket.write(payload);
    })
  }

  private handleValidation(data: Buffer) {
    /** TODO：
     * The message is used to tell Gossip whether the GOSSIP NOTIFICATION with the given message ID 
     * is well-formed or not. The bitfield V, if set signifies the the notification is wellformed; 
     * otherwise it is to be deemed invalid and hence should not be propagated further.
     */
    const messageID = data.subarray(32, 48);
    const reserved = data.subarray(48, 55);
    const valid = data.subarray(55, 56);

    console.log(`messageID: ${messageID}`);
    console.log(`reserved: ${reserved}`);
    console.log(`valid: ${valid}`);

    if (valid.readUInt8(0) === 1) {
      this.broadcast(messageID.toString("base64"));
    } else {
      this.handleErrorMesssage(messageID);
    }
  }

  private getNetAddresses(socket: net.Socket) {
    return socket.remoteAddress + ':' + socket.remotePort;
  }
}
