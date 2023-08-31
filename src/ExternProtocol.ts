import { EncryptionType, ChallengeType } from "./TypeDefiniton";

export type GossipEnrollInit = {
    messageTypeId: 505,
    publicKey: string //PEM
}

export type GossipEnrollChallenge = {
    messageTypeId: 506,
    challengeType: ChallengeType.SHA256_6
    challenge: string //64 bytes Buffer in Base64
}


export type GossipEnrollRegister = {
    messageTypeId: 507,
    challenge: string //64 bytes Buffer in Base64
    nonce: string //64 bytes Buffer in Base64
    publicKey: string //PEM
}


export type GossipEnrollSuccess = {
    messageTypeId: 508,
    sizeOfNeighbours: number
    neighbours: {
        ip: string,
        publicKey: string //PEM
    }[]
}
export type GossipEnrollFailed = {
    messageTypeId: 509,
    sizeOfNeighbours: number
    neighbours: {
        ip: string,
        publicKey: string //PEM
    }[]
}
export type GossipAnnounce = {
    messageTypeId: 510,
    messageId: string //(hash value of the original message),
    message: string //encrypted message,
    keyList: string[] //(array of public keys),
    sizeOfNeighbours: number,
    TTL: number
}

