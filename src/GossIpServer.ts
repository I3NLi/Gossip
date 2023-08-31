/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as net from 'net';
import shuffle from 'lodash/shuffle';
import randomBytes from 'randombytes';

import MESSAGETYPE from './MessageType';

import { add } from 'lodash';
import { createHash } from 'crypto';
import { serialize, deserialize, BSONError } from 'bson';

/**.ini */
const ENROLL_TIMEOUT = 15000;
const MAX_SIZE_OF_NEIGHBERS_TO_SHARE = 3;

/** Type Declaration */
enum EncryptionType {
  RSA = 0, //RSA2048
  RSA2048 = 0,
}
type Header = { size: number, messageType: number }
type RegisterMessage = { messageType: string, challenge: string, nonce: string, encryptionType: EncryptionType, publicKey: string }

export default class GossipServer {
  /* Shared */
  // store the cache of the messages
  private Cache: any = {};
  private InternServer: net.Server;
  private ExternServer: net.Server;

  /* Intern Only */
  // store the subscribed topics relation with socket
  private Topics: { [dataType: string]: net.Socket[] } = {};

  /* Extern Only */
  private Peer: { [publicKey: string]: { [socket: string]: net.Socket } } = {};
  private Challenges: { [address: string]: { challenge: string, destroyClockId: ReturnType<typeof setTimeout>, socket: net.Socket } } = {};

  constructor(internPort = 7001, externPort = 4000) {
    // Create internal and external servers
    this.InternServer = net.createServer();
    this.ExternServer = net.createServer();

    // Listen on specified ports
    this.InternServer.listen(internPort);
    // this.ExternServer.listen(externPort);

    // Set up event handlers for internal and external connections
    this.InternServer.on('connection', this.handleInternConnection.bind(this));
    this.ExternServer.on('connection', this.handleExternConnection.bind(this));
    console.log('GossipServer created');
  }

  /** Intern Only */
  private handleInternConnection(socket: net.Socket) {
    // Handle Connection from internal clients(other modules)
    console.log('New internClient connected from ' + this.getNetAddresses(socket));

    socket.on('data', (data: Buffer) => {
      const { size, messageType } = this.getHeader(data);

      console.log(`Received data from internClient client: ${this.getNetAddresses(socket)}`);
      console.log(`Message Size: ${size}`);
      console.log(`Message Type: ${messageType} ${MESSAGETYPE.getName(messageType.toString())}`);

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
   * To handle the announcement request.
   * @param data The message received.
   */
  private handleAnnounce(data: Buffer) {
    // Extract Time-to-Live (TTL) value from the data starting at index 4 with a length of 1 byte.
    // The TTL field specifies until how many hops the overlying application requires this data
    // to be spread.
    const ttl = data.readUIntBE(4, 1);

    // Extract the reserved field from the data starting at index 5 with a length of 1 byte.
    const reserved = data.readUIntBE(5, 1);

    // Extract the data type from the data starting at index 6 using 2 bytes (UInt16).
    const dataType = data.readUInt16BE(6);

    // Extract the message data from the data starting at index 8 to the end of the array.
    const messageData = data.subarray(8);

    // Display extracted values with explanatory messages.
    console.log(`TTL: ${ttl}`);
    console.log(`Reserved: ${reserved}`);
    console.log(`Data Type: ${dataType}`);
    console.log(`Message Data: ${messageData.toString()}`);
    console.log('\n');

  }

  /**
 * Handles the incoming notification message.
 * @param {Buffer} data - The incoming message data.
 * @param {net.Socket} socket - The socket associated with the incoming message.
 */
private handleNotify(data: Buffer, socket: net.Socket) {
  // Extract reserved field from the data using 2 bytes (UInt16).
  const reserved = data.readUInt16BE(4);

  // Extract data type from the data using 2 bytes (UInt16).
  const dataType = data.readUInt16BE(6);

  // Check if the topic array for this data type exists, and create it if not.
  if (this.Topics[dataType] === undefined) {
    this.Topics[dataType] = [];
  }

  // Add the socket to the list of sockets interested in this data type.
  if (this.Topics[dataType].includes(socket)) {
    console.error('Socket already in topic');
  } else {
    this.Topics[dataType].push(socket);
  }

  // Display extracted values for logging or debugging.
  console.log(`Reserved: ${reserved}`);
  console.log(`Data Type: ${dataType}`);
}



  /** Extern Only */
  private handleExternConnection(socket: net.Socket) {
    /**TODO
     */

    const address = this.getNetAddresses(socket);
    this.sendChallenge(socket);
    console.log(``);
    console.log('New externClient connected from ' + address);

    socket.on('data', (data: Buffer) => {
      const { size, messageType } = this.getHeader(data);

      console.log(``);
      console.log(`Received data from internClient client: ${data}`);
      console.log(`Message Type: ${messageType} ${MESSAGETYPE.getName(messageType.toString())}`);

      // Dispatch message to corresponding handler
      if (MESSAGETYPE.getName(messageType.toString()) === 'GOSSIP ENROLL REGISTER') {
        this.handleRegister(socket, data);
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

  private sendChallenge(socket: net.Socket) {
    const address = this.getNetAddresses(socket);
    const challenge = randomBytes(64);

    const destroyClockId = setTimeout(() => {
      socket.end();
    }, ENROLL_TIMEOUT);

    this.Challenges[address] = {
      challenge: challenge.toString('hex'),
      destroyClockId: destroyClockId,
      socket: socket
    }
  }

  private handleRegister(socket: net.Socket, data: Buffer) {
    const challenge = data.subarray(0, 8);
    const nonce = data.subarray(8, 16);
    // reserved for future use, currently only SHA-256 is supported
    const HashAlgorithmType = data.readUIntBE(16, 1);
    // reserved for future use, currently only RSA-2048 is supported
    const encryptionType = data.readUIntBE(17, 1);
    const publicKey = data.subarray(18);

    const payload = Buffer.concat([challenge, nonce, publicKey]);
    const address = this.getNetAddresses(socket);

    if (this.verifyChallenge(payload)) {
      this.Peer[publicKey.toString('ascii')] = { socket: socket };
      clearTimeout(this.Challenges[address].destroyClockId);
      delete this.Challenges[address];
      this.sendRegisterSuccess(socket);
    } else {
      clearTimeout(this.Challenges[address].destroyClockId);
      socket.end();
    }
  }


  private sendRegisterSuccess(socket: net.Socket) {
    const sizeOfNeighbers= Object.keys(this.Peer).length;
    let sizeOfNeighbersToShare: number = sizeOfNeighbers / 2;
    sizeOfNeighbersToShare = Math.min(sizeOfNeighbersToShare, MAX_SIZE_OF_NEIGHBERS_TO_SHARE);

    const sizeOfNeighbersBuffer = Buffer.alloc(1).writeUIntBE(sizeOfNeighbers,0,1);
    const encryptionTypeBuffer = Buffer.alloc(1).writeUIntBE(EncryptionType.RSA2048,0,1);
    const SharedNeighbersBuffer = Buffer.alloc(18 * sizeOfNeighbersToShare);

    //get random neighbers slice from peer
    const peerKeys = shuffle(Object.keys(this.Peer));
    const randomNeighbers = peerKeys.slice(0, sizeOfNeighbersToShare);

    const addressBuffers: Buffer[] = [];
    // write random neighbers to buffer
    randomNeighbers.forEach((publicKey, index) => {
      const ip = this.Peer[publicKey].socket.remoteAddress
      const port = this.Peer[publicKey].socket.remotePort;

      // const ipBuffer = net.isIPv6(ip) ? ip6.toBuffer(ip) : ip.toBuffer(ip);
      // const portBuffer = Buffer.alloc(2).writeUInt16BE(port);

      addressBuffers.push(Buffer.concat([ipBuffer, portBuffer]));
    });

    const payload = Buffer.concat(addressBuffers);
    this.sendResponse(socket, 507, payload);
  }

  private verifyChallenge(payload: Buffer): boolean {
    const sha256 = createHash('sha256').update(payload).digest('hex');
    return sha256.startsWith('000000');
  }
  // do {
  //   let nonce = randomBytes(8);

  //   payload = Buffer.concat(
  //       [challenge,
  //           teamNumber,
  //           projectChoice,
  //           nonce,
  //           Buffer.from(utf8encoder.encode(
  //               email + "\r\n"
  //               + firstname + "\r\n"
  //               + lastname + "\r\n"
  //               + lrzGitLabUsername))]);

  //   // console.log(`paylpoad: ${payload.toString("hex")}`);
  //   // console.log(`paylpoad: "${payload.toString("ascii")}"`);
  //   // payloadUTF8 = hexToUtf8(payload);
  //   // console.log(`paylpoad utf8: ${stringToHex(payloadUTF8)}`);
  //   // // console.log(stringToHex(payloadUTF8)==payload);

  //   sha256 = createHash('sha256').update(payload).digest('hex');
  //   // sha256="000000cec83b9daf2984245367d702a8331b292bb5737"

  // } while (!sha256.startsWith('000000'))

  /** Shared */
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

  private getHeader(data: Buffer): Header {
    const size = data.readUInt16BE(0);
    const messageType = data.readUInt16BE(2);
    return { size, messageType };
  }

  private broadcast(messageID: Buffer) {

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
      this.broadcast(messageID);
    } else {
      this.handleErrorMesssage(messageID);
    }
  }

  private getNetAddresses(socket: net.Socket) {
    return socket.remoteAddress + ':' + socket.remotePort;
  }
}
