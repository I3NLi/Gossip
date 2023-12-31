import {
    sign,
    verify,
    signWithKeyList,
    verifyWithKeyList,
    getVerifyData,
} from '../src/Cryption';
import * as crypto from 'crypto';

describe('Crypto Utils', () => {
    // Mock private and public keys for testing
    const keyPairs: crypto.KeyPairSyncResult<string, string>[] = [];
    const publicKeyList: string[] = [];
    const privateKeyList: string[] = [];


    // Generate 3 key pairs
    for (let i = 0; i < 3; i++) {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        keyPairs.push({ publicKey, privateKey });
        publicKeyList.push(publicKey);
        privateKeyList.push(privateKey);
    }

    // 正常情况下的测试
    describe('Sign and Verify', () => {
        it('should sign and verify data', () => {
            const data = Buffer.from('Hello, World!');
            const { publicKey, privateKey } = keyPairs[0]; // 选择第一对密钥
            const signature = sign(data, privateKey);
            const isValid = verify(data, signature, publicKey);
            expect(isValid).toBe(true);
        });
    });

    // 异常情况下的测试
    describe('Error Handling', () => {
        it('should throw an error when verifying with invalid data', () => {
            const validData = Buffer.from('Hello, World!');
            const invalidData = Buffer.from('Modified Data');
            const { publicKey, privateKey } = keyPairs[1]; // 选择第二对密钥
            const signature = sign(validData, privateKey);
            const isValid = verify(invalidData, signature, publicKey);
            expect(isValid).toBe(false);
        });

        it('should throw an error when verifying with invalid signature', () => {
            const data = Buffer.from('Hello, World!');
            const { publicKey } = keyPairs[2]; // 选择第三对密钥
            const invalidSignature = Buffer.from('InvalidSignature');
            const isValid = verify(data, invalidSignature, publicKey);
            expect(isValid).toBe(false);
        });

        it('should throw an error when signing with an empty private key', () => {
            expect(() => sign(Buffer.from('Data'), '')).toThrowError();
        });

        it('should throw an error when privateKeyList is empty', () => {
            const data = Buffer.from('Test data');
            const emptyPrivateKeyList: string[] = [];

            // 使用匿名函数包装以确保抛出错误时不会立即终止测试
            const testFunction = () => {
                signWithKeyList(data, emptyPrivateKeyList, 'SHA256');
            };

            // 使用 toThrow 匹配器来验证是否抛出了错误
            expect(testFunction).toThrow('Private key list is empty');
        });
        it('should throw an error when publicKeyList is empty', () => {
            const emptyPublicKeyList: string[] = [];
            const data = new Uint8Array([1, 2, 3]); // 用于测试的数据
            const hashType = 'SHA256';

            // 使用匿名函数包装以确保抛出错误时不会立即终止测试
            const testFunction = () => {
                getVerifyData(data, emptyPublicKeyList, hashType);
            };

            // 使用 toThrow 匹配器来验证是否抛出了错误
            expect(testFunction).toThrow('Public key list is empty');
        });
        it('should return false when signature is invalid', () => {
            const data = Buffer.from('Test data');
            const publicKey = publicKeyList[0]; // 有效的公钥
            const hashType = 'SHA256';

            // 创建一个有效签名（这里使用了一个不匹配的签名）
            const validSignature = Buffer.from('valid-signature');

            // 调用 verify 函数，传入不匹配的签名
            const result = verify(data, validSignature, publicKey, hashType);

            // 验证函数返回值是否为 false
            expect(result).toBe(false);
        });
        // it('should sign and verify data with key list and return buffer', () => {
        //     const data = Buffer.from('Hello, World!XXXXXXXXXX');
        //     const signaturedData = signWithKeyList(data, privateKeyList);
        //     expect(getVerifyData(signaturedData, publicKeyList.slice(2))).toBeUndefined();
        // });
    });

    // 使用密钥列表的测试
    describe('Sign and Verify with Key List 0-2', () => {
        it('should sign and verify data with key list', () => {
            const data = Buffer.from('Hello, World!');
            const signaturedData = signWithKeyList(data, privateKeyList.slice(0, 1));
            const isValid = verifyWithKeyList(signaturedData, publicKeyList.slice(0, 1));
            expect(isValid).toBe(true);
        });

        it('should throw an error when verifying with empty public key list', () => {
            expect(() => verifyWithKeyList(Buffer.from('Data'), [], 'SHA256')).toThrowError();
        });
    });
    describe('Sign and Verify with Key List', () => {
        it('should sign and verify data with key list', () => {
            const data = Buffer.from('Hello, World!');
            const signaturedData = signWithKeyList(data, privateKeyList);
            const isValid = verifyWithKeyList(signaturedData, publicKeyList);
            expect(isValid).toBe(true);
        });

        it('should throw an error when verifying with empty public key list', () => {
            expect(() => verifyWithKeyList(Buffer.from('Data'), [], 'SHA256')).toThrowError();
        });
        it('should sign and verify data with key list and return buffer', () => {
            const data = Buffer.from('Hello, World!');
            const signaturedData = signWithKeyList(data, privateKeyList);
            const verfiyedData = getVerifyData(signaturedData, publicKeyList);
            expect(verfiyedData?.toString("base64")).toBe(data.toString('base64'));
        });
    });


});
