import { unlink } from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import { createHash, createDecipheriv } from "crypto";
import { pipeline } from "stream/promises";
import { PDFMetadataParser, PDFMetadata } from "./metadata.js";

export interface DecryptionResult {
  success: boolean;
  metadata?: PDFMetadata;
  error?: string;
}

export class PDFDecrypt {
  private static readonly IV_HEX = "31323334353637383837363534333231";
  private static readonly AES256CBC_ID = 0x8d;

  private static async verifyIntegrity(
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

  private static async performDecryption(
    inputPath: string,
    outputPath: string,
    password: string,
    metadata: PDFMetadata
  ): Promise<void> {
    const { header, footer, dataRange } = metadata;

    await this.verifyIntegrity(
      inputPath,
      dataRange.dataStart,
      dataRange.dataEnd,
      footer.destinationMd5,
      footer.destinationSha256
    );
    if (header.evpCipher !== this.AES256CBC_ID) {
      throw new Error(`Unsupported cipher method: ${header.evpCipherDesc}`);
    }

    const keyBuffer = Buffer.from(password, "utf-8");
    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid key length`);
    }
    const iv = Buffer.from(this.IV_HEX, "hex");
    if (iv.length !== 16) {
      throw new Error(`Invalid IV length`);
    }

    await pipeline(
      createReadStream(inputPath, {
        start: dataRange.dataStart,
        end: dataRange.dataEnd,
      }),
      createDecipheriv("aes-256-cbc", keyBuffer, iv),
      createWriteStream(outputPath)
    );

    await this.verifyIntegrity(
      outputPath,
      0,
      dataRange.totalSize - 1,
      header.sourceMd5,
      header.sourceSha256
    );
  }

  public static async decrypt(
    inputPath: string,
    outputPath: string,
    password: string
  ): Promise<DecryptionResult> {
    try {
      const metadata = PDFMetadataParser.extractMetadata(inputPath);
      await this.performDecryption(inputPath, outputPath, password, metadata);
      return {
        success: true,
        metadata,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      try {
        await unlink(outputPath);
      } catch (e) {}
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
