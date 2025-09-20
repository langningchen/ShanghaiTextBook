import { log, spinner } from "@clack/prompts";
import { BookData } from "./types";
import { Server } from "./server.js";
import AdmZip from "adm-zip";
import { Buffer } from "buffer";
import { PDFDecrypt } from "./pdf/decrypt.js";
import {
  copyFileSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";

export class BookProcess {
  private static readonly chunkSize = 50 * 1024 * 1024;

  private static removeDir(path: string) {
    if (statSync(path).isDirectory()) {
      for (const file of readdirSync(path)) {
        this.removeDir(join(path, file));
      }
      rmdirSync(path);
    } else {
      unlinkSync(path);
    }
  }

  private static async dataExists(uuid: string): Promise<boolean> {
    const jsonExists = statSync(`./books/${uuid}.json`, {
      throwIfNoEntry: false,
    });
    const pdfExists = statSync(`./books/${uuid}.pdf`, {
      throwIfNoEntry: false,
    });
    const pdfPartExists = statSync(`./books/${uuid}.pdf.1`, {
      throwIfNoEntry: false,
    });
    const jpgExists = statSync(`./books/${uuid}.jpg`, {
      throwIfNoEntry: false,
    });
    const pngExists = statSync(`./books/${uuid}.png`, {
      throwIfNoEntry: false,
    });
    return !!(
      jsonExists &&
      (pdfExists || pdfPartExists) &&
      (jpgExists || pngExists)
    );
  }

  static async process(
    bookData: BookData,
    s: ReturnType<typeof spinner>
  ): Promise<boolean> {
    if (await this.dataExists(bookData.uuid)) {
      s.message(`Skipping ${bookData.title}, data already exists`);
      return true;
    }

    s.message(`Processing ${bookData.title}, downloading...`);
    const fileResponse = await fetch(bookData.file_path);
    if (!fileResponse.ok) {
      log.error(
        `Failed to download ${bookData.title}: ${fileResponse.statusText}`
      );
      return false;
    }
    const arrayBuffer = await fileResponse.arrayBuffer();

    s.message(`Processing ${bookData.title}, unzipping...`);
    const zip = new AdmZip(Buffer.from(new Uint8Array(arrayBuffer)));
    zip.extractAllTo(`./books/${bookData.uuid}`, true);
    let imageCopied = false;
    for (const ext of ["jpg", "png"]) {
      const src = `./books/${bookData.uuid}/${bookData.uuid}.${ext}`;
      const dest = `./books/${bookData.uuid}.${ext}`;
      try {
        copyFileSync(src, dest);
        imageCopied = true;
        break;
      } catch {}
    }
    if (!imageCopied) {
      log.warn(`No cover image found for ${bookData.title}`);
    }
    writeFileSync(
      `./books/${bookData.uuid}.json`,
      JSON.stringify(bookData, null, 2)
    );

    s.message(`Processing ${bookData.title}, getting decryption key...`);
    const key = await Server.getKey(bookData.uuid);

    s.message(`Processing ${bookData.title}, decrypting...`);
    const result = await PDFDecrypt.decrypt(
      `./books/${bookData.uuid}/${bookData.uuid}.pdf`,
      `./books/${bookData.uuid}.pdf`,
      key
    );
    if (!result.success) {
      log.error(`Failed to decrypt ${bookData.title}: ${result.error}`);
      return false;
    }

    s.message(`Processing ${bookData.title}, checking file size...`);
    const stats = statSync(`./books/${bookData.uuid}.pdf`);
    if (stats.size > this.chunkSize) {
      s.message(`Processing ${bookData.title}, splitting large PDF...`);
      const totalChunks = Math.ceil(stats.size / this.chunkSize);
      const fileBuffer = Buffer.from(
        readFileSync(`./books/${bookData.uuid}.pdf`)
      );
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, stats.size);
        const chunkBuffer = fileBuffer.subarray(start, end);
        writeFileSync(`./books/${bookData.uuid}.pdf.${i + 1}`, chunkBuffer);
      }
      unlinkSync(`./books/${bookData.uuid}.pdf`);
    }

    s.message(`Processing ${bookData.title}, cleaning up...`);
    this.removeDir(`./books/${bookData.uuid}`);

    s.stop(`Processing ${bookData.title}, done`);
    return true;
  }
}
