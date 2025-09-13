import { open, unlink } from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import { createHash, createDecipheriv } from "crypto";
import { pipeline } from "stream/promises";
import { Transform } from "stream";
import { FileHandle } from "fs/promises";

interface CipherDetails {
  algorithm: string;
  keyLength: number;
}

const constants = {
  HEADER_SIZE: 1024,
  FOOTER_SIZE: 1024,
  HEADER: {
    SRC_SHA256_OFFSET: 88,
    SRC_SHA256_LENGTH: 32,
    CIPHER_ID_OFFSET: 212,
  },
  FOOTER: {
    DST_MD5_OFFSET: 132,
    DST_MD5_LENGTH: 16,
    DST_SHA256_OFFSET: 148,
    DST_SHA256_LENGTH: 32,
  },
};

const HARDCODED_IV_HEX = "31323334353637383837363534333231";

function getCipherDetails(cipherId: number): CipherDetails {
  switch (cipherId) {
    case 0x65:
      return { algorithm: "aes-128-cbc", keyLength: 16 };
    case 0x79:
      return { algorithm: "aes-192-cbc", keyLength: 24 };
    case 0x8d:
      return { algorithm: "aes-256-cbc", keyLength: 32 };
    default:
      throw new Error(`Unsupported Cipher ID: ${cipherId}`);
  }
}

async function verifyIntegrity(
  inputPath: string,
  start: number,
  end: number,
  expectedMd5: string,
  expectedSha256: string
): Promise<void> {
  const readStream = createReadStream(inputPath, { start, end });
  const md5Hash = createHash("md5");
  const sha256Hash = createHash("sha256");

  for await (const chunk of readStream) {
    md5Hash.update(chunk);
    sha256Hash.update(chunk);
  }

  const calculatedMd5 = md5Hash.digest("hex");
  const calculatedSha256 = sha256Hash.digest("hex");

  if (
    calculatedMd5.toLowerCase() !== expectedMd5.toLowerCase() ||
    calculatedSha256.toLowerCase() !== expectedSha256.toLowerCase()
  ) {
    throw new Error("Integrity check failed");
  }
}

export async function decryptPdf(
  inputPath: string,
  outputPath: string,
  password: string
): Promise<boolean> {
  let fileHandle: FileHandle | undefined;
  let success = false;

  try {
    fileHandle = await open(inputPath, "r");
    const stats = await fileHandle.stat();

    if (stats.size < constants.HEADER_SIZE + constants.FOOTER_SIZE) {
      throw new Error("Invalid file size");
    }

    const headerBuffer = await fileHandle
      .read(Buffer.alloc(constants.HEADER_SIZE), 0, constants.HEADER_SIZE, 0)
      .then((r) => r.buffer);
    const footerBuffer = await fileHandle
      .read(
        Buffer.alloc(constants.FOOTER_SIZE),
        0,
        constants.FOOTER_SIZE,
        stats.size - constants.FOOTER_SIZE
      )
      .then((r) => r.buffer);

    const expectedBodyMd5 = footerBuffer
      .subarray(
        constants.FOOTER.DST_MD5_OFFSET,
        constants.FOOTER.DST_MD5_OFFSET + constants.FOOTER.DST_MD5_LENGTH
      )
      .toString("hex");
    const expectedBodySha256 = footerBuffer
      .subarray(
        constants.FOOTER.DST_SHA256_OFFSET,
        constants.FOOTER.DST_SHA256_OFFSET + constants.FOOTER.DST_SHA256_LENGTH
      )
      .toString("hex");

    await verifyIntegrity(
      inputPath,
      constants.HEADER_SIZE,
      stats.size - constants.FOOTER_SIZE - 1,
      expectedBodyMd5,
      expectedBodySha256
    );

    const cipherId = headerBuffer.readUInt32LE(
      constants.HEADER.CIPHER_ID_OFFSET
    );
    const { algorithm, keyLength } = getCipherDetails(cipherId);
    const keyBuffer = Buffer.from(password, "utf8");
    if (keyBuffer.length !== keyLength) {
      throw new Error(
        `Invalid key length. Expected ${keyLength} bytes, got ${keyBuffer.length}`
      );
    }

    const iv = Buffer.from(HARDCODED_IV_HEX, "hex");
    const readStream = createReadStream(inputPath, {
      fd: fileHandle.fd,
      start: constants.HEADER_SIZE,
      end: stats.size - constants.FOOTER_SIZE - 1,
      autoClose: false,
    });
    const writeStream = createWriteStream(outputPath);
    const decipher = createDecipheriv(algorithm, keyBuffer, iv);
    const hash = createHash("sha256");
    const hashUpdater = new Transform({
      transform(chunk, _enc, cb) {
        hash.update(chunk);
        this.push(chunk);
        cb();
      },
    });

    await pipeline(readStream, decipher, hashUpdater, writeStream);

    const expectedSha256 = headerBuffer
      .subarray(
        constants.HEADER.SRC_SHA256_OFFSET,
        constants.HEADER.SRC_SHA256_OFFSET + constants.HEADER.SRC_SHA256_LENGTH
      )
      .toString("hex");
    const calculatedSha256 = hash.digest("hex");
    if (calculatedSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new Error("Final hash verification failed");
    }

    success = true;
    return true;
  } catch (error) {
    throw error;
  } finally {
    if (fileHandle) await fileHandle.close();
    if (!success) {
      try {
        await unlink(outputPath);
      } catch (e) {}
    }
  }
}
