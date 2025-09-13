#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');

// =============================================================================
//  ANSI Colors for better logging
// =============================================================================
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
};

// =============================================================================
//  Constants and Configuration (FINAL & VERIFIED)
// =============================================================================
const PASSPHRASE = 'M+ahpmjFDJmxY8491or9pwnK5U8GVW3a';
const HEADER_SIZE = 1024;
const FOOTER_SIZE = 1024;
const KEY_LENGTH = 32;

// Offsets are relative to the start of the deobfuscated header
const IV_OFFSET = 0;
const SALT_OFFSET = 204;
const SHA256_OFFSET = 88;

// =============================================================================
//  Core Logic
// =============================================================================

/**
 * Implements the proprietary byte-shuffling deobfuscation.
 */
function deobfuscateHeader(buffer) {
    const deobfuscated = Buffer.from(buffer);
    const v14 = deobfuscated.readUInt32LE(68);
    deobfuscated.writeUInt32LE(0, 68);
    deobfuscated[68] = v14 & 0xFF;
    deobfuscated[70] = (v14 >> 16) & 0xFF;
    deobfuscated[71] = (v14 >> 24) & 0xFF;
    return deobfuscated;
}

/**
 * Derives the 32-byte AES-256 key using the proprietary algorithm.
 * Key = MD5(Passphrase + Salt) + MD5(MD5(Passphrase + Salt))
 */
function deriveKey(passphrase, salt) {
    const passBuffer = Buffer.from(passphrase, 'utf8');
    const hash1 = crypto.createHash('md5').update(Buffer.concat([passBuffer, salt])).digest();
    const hash2 = crypto.createHash('md5').update(hash1).digest();
    return Buffer.concat([hash1, hash2], KEY_LENGTH);
}

/**
 * Reads a null-terminated string from a buffer.
 */
function readNullTerminatedString(buffer, offset) {
    const end = buffer.indexOf(0, offset);
    return buffer.toString('utf8', offset, end > -1 ? end : undefined).trim();
}

/**
 * Reads and formats a 64-bit timestamp.
 */
function formatTimestamp(buffer, offset) {
    try {
        const seconds = buffer.readBigInt64LE(offset);
        if (seconds < 946684800) {
            return `Invalid/Obfuscated Timestamp (raw: ${seconds})`;
        }
        return new Date(Number(seconds) * 1000).toISOString();
    } catch (e) {
        return "Invalid Timestamp";
    }
}

/**
 * Converts raw bytes to a hex string.
 */
function bytesToHexString(buffer) {
    return buffer.toString('hex');
}

// =============================================================================
//  Main Data Extraction and Calculation Function
// =============================================================================
function extractAndCalculateMetadata(inputPath) {
    try {
        console.log(`[INFO] Reading file: ${inputPath}`);
        const fileBuffer = fs.readFileSync(inputPath);
        const totalSize = fileBuffer.length;

        if (totalSize < HEADER_SIZE + FOOTER_SIZE) {
            throw new Error(`File size (${totalSize} bytes) is too small.`);
        }

        const rawHeader = fileBuffer.slice(0, HEADER_SIZE);
        const encryptedData = fileBuffer.slice(HEADER_SIZE, totalSize - FOOTER_SIZE);
        const rawFooter = fileBuffer.slice(totalSize - FOOTER_SIZE);

        // 1. Deobfuscate the header.
        const header = deobfuscateHeader(rawHeader);
        console.log("[INFO] Header has been deobfuscated using proprietary byte-shuffling.");

        // 2. Extract Salt and IV from the DEOBFUSCATED header.
        const salt = header.slice(SALT_OFFSET, SALT_OFFSET + 8);
        const ivBuffer = header.slice(IV_OFFSET, IV_OFFSET + 16);

        // 3. Derive the file-specific key.
        const keyBuffer = deriveKey(PASSPHRASE, salt);

        // 4. Decrypt the main content.
        console.log(`[INFO] Decrypting ${encryptedData.length} bytes to calculate final hash...`);
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
        decipher.setAutoPadding(false);
        const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

        // 5. [CRITICAL] Calculate the SHA256 of the DECRYPTED data.
        const file_decrypt_sha256 = crypto.createHash('sha256').update(decryptedData).digest('hex');
        console.log(`[INFO] Calculation complete.`);

        console.log(colors.cyan, "\n--- Extracted and Calculated Metadata ---", colors.reset);

        // 6. Display all header metadata
        const headerReport = [
            { "C++ Variable": "v115 (file_begin)", "Value": bytesToHexString(header.slice(0, 64)) },
            { "C++ Variable": "v91 (head_version)", "Value": header.readUInt32LE(64) },
            { "C++ Variable": "v94 (body_version)", "Value": header.readUInt32LE(68) },
            { "C++ Variable": "v121 (le_src_md5)", "Value": bytesToHexString(header.slice(72, 88)) },
            { "C++ Variable": "v114 (le_src_sha256)", "Value": bytesToHexString(header.slice(88, 120)) },
            { "C++ Variable": "Time (create_time)", "Value": formatTimestamp(header, 204) },
            { "C++ Variable": "v92 (file_method)", "Value": header.readUInt32LE(208) },
            { "C++ Variable": "v93 (evp_cipher)", "Value": header.readUInt32LE(212) },
            { "C++ Variable": "v116 (evp_cipher_desc)", "Value": readNullTerminatedString(header, 216) }
        ];
        console.log("\n[HEADER METADATA (from deobfuscated header)]");
        console.table(headerReport);

        // 7. Display all footer metadata
        const footerReport = [
            { "C++ Variable": "v98 (tail_version)", "Value": rawFooter.readUInt32LE(0) },
            { "C++ Variable": "v122 (le_dst_md5)", "Value": bytesToHexString(rawFooter.slice(132, 148)) },
            { "C++ Variable": "v110 (le_dst_sha256)", "Value": bytesToHexString(rawFooter.slice(148, 180)) },
            { "C++ Variable": "v89 (update_time)", "Value": formatTimestamp(rawFooter, 264) },
            { "C++ Variable": "v109 (copy_right)", "Value": readNullTerminatedString(rawFooter, 832) },
            { "C++ Variable": "v117 (file_end)", "Value": rawFooter.slice(960, 976).toString('hex') }
        ];
        console.log("\n[FOOTER METADATA (from raw footer)]");
        console.table(footerReport);

        // 8. Display the final calculated hash
        const calculatedReport = [
            { "C++ Variable": "v113 (file_decrypt_sha256)", "Value": file_decrypt_sha256, "Source": "Calculated from decrypted data" }
        ];
        console.log("\n[CALCULATED HASH]");
        console.table(calculatedReport);


    } catch (error) {
        console.error(colors.red, `\n[FATAL ERROR] An error occurred: ${error.message}`, colors.reset);
        process.exit(1);
    }
}

// =============================================================================
//  Command-Line Interface
// =============================================================================
function main() {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.log("Usage: node info.js <encrypted_file>");
        console.log("Example: node info.js ./encrypted.pdf");
        process.exit(1);
    }
    const [inputPath] = args;
    if (!fs.existsSync(inputPath)) {
        console.error(colors.red, `[ERROR] Input file not found: ${inputPath}`, colors.reset);
        process.exit(1);
    }
    extractAndCalculateMetadata(inputPath);
}

main();
