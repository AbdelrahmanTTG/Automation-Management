import pako from "pako";
import CryptoJS from "crypto-js";
const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "MY_SECRET_KEY";
function getKey() {
  return CryptoJS.SHA256(SECRET_KEY);
}
function getIv() {
  const hash = CryptoJS.SHA256(SECRET_KEY).toString();
  return CryptoJS.enc.Utf8.parse(hash.substring(0, 16));
}
export function encryptData(data) {
  const jsonString = JSON.stringify(data);
  const uint8Array = new TextEncoder().encode(jsonString);
  const compressed = pako.deflate(uint8Array);
  const wordArray = CryptoJS.lib.WordArray.create(compressed);
  const encrypted = CryptoJS.AES.encrypt(wordArray, getKey(), {
    iv: getIv(),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}
export function decryptData(encryptedData) {
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(encryptedData),
  });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, getKey(), {
    iv: getIv(),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const decryptedArray = new Uint8Array(decrypted.sigBytes);
  for (let i = 0; i < decrypted.sigBytes; i++) {
    decryptedArray[i] =
      (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  const decompressed = pako.inflate(decryptedArray, { to: "string" });
  return JSON.parse(decompressed);
}
