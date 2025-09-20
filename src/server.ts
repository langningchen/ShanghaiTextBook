import { createHash } from "crypto";
import { Token } from "./token.js";
import { BookData } from "./types.js";
import { spinner } from "@clack/prompts";

export class Server {
  static readonly SERVER = "https://appsupport.sh-genius.cn";
  static readonly BOOKCASE_ENDPOINT = "/teaching/api/v1/usebook/web/bookcase";
  static readonly KEY_ENDPOINT = "/teaching/api/v1/textbook/key/";
  static readonly APP_ID = "Cm898ZMkxo7OlBlO";
  static readonly SECURITY_KEY = "e3YCNDTCzmB6fvRC";

  private static async getSignature(
    context: string,
    token: string
  ): Promise<{ CHINESEALL_SIGN: string; CHINESEALL_SIGN_EXP: string }> {
    const CHINESEALL_SIGN_EXP = Date.now().toString();
    return {
      CHINESEALL_SIGN: createHash("md5")
        .update(
          `CHINESEALL_SIGN_EXP=${CHINESEALL_SIGN_EXP}` +
            `&CHINESEALL_TOKEN=${token}` +
            `&CONTEXT=${context}` +
            `&SECURITY_KEY=${this.SECURITY_KEY}`
        )
        .digest("hex"),
      CHINESEALL_SIGN_EXP,
    };
  }

  static async getBookcase(): Promise<BookData[]> {
    const token = await Token.getToken();
    const s = spinner();
    s.start("Fetching bookcase...");
    return fetch(this.SERVER + this.BOOKCASE_ENDPOINT, {
      headers: {
        "Content-Type": "application/json",
        APP_ID: this.APP_ID,
        CHINESEALL_TOKEN: token,
        ...(await this.getSignature(this.BOOKCASE_ENDPOINT, token)),
      },
    })
      .then((res) => res.json())
      .then(({ data }) => data)
      .finally(() => s.stop("Fetched bookcase"));
  }

  static async getKey(bookId: string): Promise<string> {
    const token = await Token.getToken();
    return fetch(this.SERVER + this.KEY_ENDPOINT + bookId, {
      headers: {
        "Content-Type": "application/json",
        APP_ID: this.APP_ID,
        CHINESEALL_TOKEN: token,
        ...(await this.getSignature(this.KEY_ENDPOINT + bookId, token)),
      },
    })
      .then((res) => res.json())
      .then(({ data }) => data);
  }
}
