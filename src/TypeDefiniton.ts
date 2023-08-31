/** Type Declaration */
export enum EncryptionType {
    RSA2048 = 0,
    // RSA3072 = 1,
    // RSA4096 = 2,
}

export enum ChallengeType {
    SHA256_6 = 0,
}
export type Header = { size: number, messageType: number }
