import crypto from 'crypto';
import bson from 'bson';

export function sign(data: Buffer, privateKey: string, hashType: string = 'SHA256'): Buffer {
    const sign = crypto.createSign(hashType);
    sign.update(data);
    return sign.sign(privateKey);
}

export function verify(data: Buffer, signature: Buffer, publicKey: string, hashType: string = 'SHA256'): boolean {
    const verify = crypto.createVerify(hashType);
    verify.update(data);
    return verify.verify(publicKey, signature);
}

export function signWithKeyList(data: Buffer, privateKeyList: string[], hashType: string = 'SHA256'): Uint8Array {
    if (privateKeyList.length === 0) {
        throw new Error('Private key list is empty');
    }

    let signedData = data.slice();

    for (const privateKey of privateKeyList) {
        const signature = sign(signedData, privateKey, hashType)
        const wrappedData = bson.serialize({ data: signedData.toString('base64'), signature: signature.toString('base64') });
        signedData = Buffer.from(wrappedData);
    }

    return signedData;
}

export function verifyWithKeyList(data: Uint8Array, publicKeyList: string[], hashType: string = 'SHA256'): boolean {
    if (publicKeyList.length === 0) {
        throw new Error('Public key list is empty');
    }

    let wrappedData = data.slice();

    for (const publicKey of publicKeyList.slice().reverse()) {
        // Unwrap data and signature using BSON
        const { data, signature } = bson.deserialize(wrappedData);


        const isSignatureValid = verify(Buffer.from(data,'base64'), Buffer.from(signature,'base64'), publicKey, hashType)

        if (!isSignatureValid) {
            return false;
        }

        wrappedData = new Uint8Array(Buffer.from(data,'base64'));
    }

    return true;
}

export function getVerifyData(data: Uint8Array, publicKeyList: string[], hashType: string = 'SHA256'): Buffer | undefined{
    if (publicKeyList.length === 0) {
        throw new Error('Public key list is empty');
    }

    let wrappedData = data.slice();
    let result: Buffer | undefined = undefined;
    for (const publicKey of publicKeyList.slice().reverse()) {
        // Unwrap data and signature using BSON
        const { data, signature } = bson.deserialize(wrappedData);


        const isSignatureValid = verify(Buffer.from(data,'base64'), Buffer.from(signature,'base64'), publicKey, hashType)

        if (!isSignatureValid) {
            console.error("signature is not valid")
            return undefined;
        }

        result=data
        wrappedData = new Uint8Array(Buffer.from(data,'base64'));

        
    }

    return result
}