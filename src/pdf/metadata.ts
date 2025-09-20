import { readFileSync } from "fs";

export interface HeaderMetadata {
  fileBegin: string;
  headVersion: number;
  bodyVersion: number;
  sourceMd5: string;
  sourceSha256: string;
  createTime: Date;
  fileMethod: number;
  evpCipher: number;
  evpCipherDesc: string;
}
export interface FooterMetadata {
  tailVersion: number;
  destinationMd5: string;
  destinationSha256: string;
  updateTime: Date;
  copyRight: string;
  fileEnd: string;
}
export interface DataRange {
  headerSize: number;
  footerSize: number;
  dataStart: number;
  dataEnd: number;
  totalSize: number;
}

export interface PDFMetadata {
  header: HeaderMetadata;
  footer: FooterMetadata;
  dataRange: DataRange;
}

export class PDFMetadataParser {
  private static readonly HEADER_SIZE = 1024;
  private static readonly FOOTER_SIZE = 1024;

  private static deobfuscateHeader(buffer: Buffer): Buffer {
    const deobfuscated = Buffer.from(buffer);
    const v14 = deobfuscated.readUInt32LE(68);
    deobfuscated.writeUInt32LE(0, 68);
    deobfuscated[68] = v14 & 0xff;
    deobfuscated[70] = (v14 >> 16) & 0xff;
    deobfuscated[71] = (v14 >> 24) & 0xff;
    return deobfuscated;
  }

  private static readNullTerminatedString(
    buffer: Buffer,
    offset: number
  ): string {
    const end = buffer.indexOf(0, offset);
    return buffer.toString("utf8", offset, end > -1 ? end : undefined).trim();
  }

  private static extractHeaderMetadata(header: Buffer): HeaderMetadata {
    return {
      fileBegin: header.subarray(0, 64).toString("hex"),
      headVersion: header.readUInt32LE(64),
      bodyVersion: header.readUInt32LE(68),
      sourceMd5: header.subarray(72, 88).toString("hex"),
      sourceSha256: header.subarray(88, 120).toString("hex"),
      createTime: new Date(Number(header.readBigInt64LE(204)) * 1000),
      fileMethod: header.readUInt32LE(208),
      evpCipher: header.readUInt32LE(212),
      evpCipherDesc: this.readNullTerminatedString(header, 216),
    };
  }
  private static extractFooterMetadata(footer: Buffer): FooterMetadata {
    return {
      tailVersion: footer.readUInt32LE(0),
      destinationMd5: footer.subarray(132, 148).toString("hex"),
      destinationSha256: footer.subarray(148, 180).toString("hex"),
      updateTime: new Date(Number(footer.readBigInt64LE(264)) * 1000),
      copyRight: this.readNullTerminatedString(footer, 832),
      fileEnd: footer.subarray(960, 976).toString("hex"),
    };
  }

  static extractMetadata(filePath: string): PDFMetadata {
    const fileBuffer = readFileSync(filePath);
    const totalSize = fileBuffer.length;
    if (totalSize < this.HEADER_SIZE + this.FOOTER_SIZE) {
      throw new Error(`File size is too small`);
    }

    const rawHeader = fileBuffer.subarray(0, this.HEADER_SIZE);
    const rawFooter = fileBuffer.subarray(totalSize - this.FOOTER_SIZE);
    const header = this.deobfuscateHeader(rawHeader);

    return {
      header: this.extractHeaderMetadata(header),
      footer: this.extractFooterMetadata(rawFooter),
      dataRange: {
        headerSize: this.HEADER_SIZE,
        footerSize: this.FOOTER_SIZE,
        dataStart: this.HEADER_SIZE,
        dataEnd: totalSize - this.FOOTER_SIZE - 1,
        totalSize: totalSize,
      },
    };
  }
}
