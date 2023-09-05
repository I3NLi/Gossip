import { ChallengeType } from "./TypeDefiniton";

// Type definition for GossipEnrollInit message
export type GossipEnrollInit = {
    messageTypeId: 505, // Unique message type identifier for GossipEnrollInit
    publicKey: string // Public key in PEM format, used to identify the peer
}

// Type definition for GossipEnrollChallenge message
export type GossipEnrollChallenge = {
    messageTypeId: 506, // Unique message type identifier for GossipEnrollChallenge
    challengeType: ChallengeType.SHA256_6 // Currently, only one supported challenge type (may change in the future)
    challengeHardness: number // Number of leading zeros in the hash; increases if the blocklist grows
    challenge: string // 64-byte Buffer in Base64 encoding
    publicKey: string // PEM format public key
}

// Type definition for GossipEnrollRegister message
export type GossipEnrollRegister = {
    messageTypeId: 507, // Unique message type identifier for GossipEnrollRegister
    challenge: string // 64-byte Buffer in Base64 encoding
    nonce: string // 64-byte Buffer in Base64 encoding
    publicKey: string // PEM format public key
    serverAddress: string // Server address
}

// Type definition for GossipEnrollSuccess message
export type GossipEnrollSuccess = {
    messageTypeId: 508, // Unique message type identifier for GossipEnrollSuccess
    publicKey: string // PEM format public key
    neighbours: {
        address: string, // Neighbor's address
        publicKey: string // Neighbor's PEM format public key
    }[]
}

// Type definition for GossipEnrollFailure message
export type GossipEnrollFailure = {
    messageTypeId: 509, // Unique message type identifier for GossipEnrollFailure
    errorMessage: string // Error message in case of failure
}

// Type definition for GossipBordcast message
export type GossipBordcast = {
    messageTypeId: 510, // Unique message type identifier for GossipBordcast
    dataTypeId: number // Data type identifier
    messageId: string // Hash value of the original message
    message: string // Encrypted message
    keyList: string[] // Array of public keys
    ttl: number // Time to live for the message, zero means no limit
}
