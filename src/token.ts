import { text, spinner } from "@clack/prompts";
import { createHash } from "crypto";

interface OldTokenType {
  idToken: string;
  expireTime: number;
}

interface TokenType {
  accessToken: string;
  expireTime: number;
}

export class Token {
  static readonly STUDY_SERVER = "https://rz.szjx.ai-study.net";
  static readonly TOKEN_ENDPOINT = "/proxy/accessToken";
  static readonly PROFILE_ENDPOINT = "/proxy/api/profile";
  static readonly CLIENT_ID = "8VCcsxC1a9c7q4fwCI";
  static readonly SALT_PREFIX = "8VCcsxC1a9c7q4fwCI";
  static readonly SALT_SUFFIX = "99ePpkU8PceXdndRXtDSngMq5hrQba";

  static readonly GENIUS_SERVER = "https://operator-api.sh-genius.cn";
  static readonly GENIUS_ENDPOINT = "/ucenter/auth/token/exchange";

  private static cachedToken: string | null;

  private static async getSignature(token: string): Promise<string> {
    return createHash("md5")
      .update(`${this.SALT_PREFIX}:${token}:${this.SALT_SUFFIX}`)
      .digest("hex");
  }
  private static async fetchToken(oldToken: string): Promise<string> {
    const s = spinner();

    try {
      s.start("Getting access token...");
      const url = new URL(this.TOKEN_ENDPOINT, this.STUDY_SERVER);
      url.searchParams.append("clientId", this.CLIENT_ID);
      url.searchParams.append("idToken", oldToken);
      url.searchParams.append("signature", await this.getSignature(oldToken));

      const tokenResponse = await fetch(url);
      const { data }: { data: TokenType } = await tokenResponse.json();

      s.message("Getting user profile...");
      const profileUrl = new URL(this.PROFILE_ENDPOINT, this.STUDY_SERVER);
      profileUrl.searchParams.append("user_token", data.accessToken);
      const profileResponse = await fetch(profileUrl, {
        headers: {
          "edu-proxy-token": data.accessToken,
        },
      });
      const profile = await profileResponse.json();
      const eduId = profile.data.edu_id;

      s.message("Exchanging for genius token...");
      const geniusResponse = await fetch(
        new URL(this.GENIUS_ENDPOINT, this.GENIUS_SERVER),
        {
          body: eduId,
          method: "POST",
        }
      );
      const geniusData = await geniusResponse.json();

      s.stop("Token fetched successfully");
      return geniusData.data.token;
    } catch (error) {
      s.stop("Failed to fetch token", 1);
      throw error;
    }
  }
  private static async getTokenBrowser(): Promise<string> {
    const input = await text({
      message:
        "Please open https://sh.etextbook.cn/ in your browser and log in, then paste the URL containing the token here",
      placeholder:
        "https://sh.etextbook.cn/?token=eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg%3D",
      validate: (value) => {
        try {
          const url = new URL(value.trim());
          if (url.origin !== "https://sh.etextbook.cn") {
            return "URL must be from https://sh.etextbook.cn";
          }
          const tokenStr = url.searchParams.get("token");
          if (!tokenStr) {
            return "Cannot find token in the URL";
          }
          const token = JSON.parse(atob(tokenStr)) as OldTokenType;
          if (token.expireTime < Date.now()) {
            return "Token has expired";
          }
          return undefined;
        } catch (e) {
          return (e as Error).message;
        }
      },
    });
    if (!input || typeof input === "symbol") {
      throw new Error("User cancelled the input");
    }

    const url = new URL(input.trim());
    const tokenStr = url.searchParams.get("token")!;
    const token = JSON.parse(atob(tokenStr)) as OldTokenType;
    return token.idToken;
  }

  static async getToken(): Promise<string> {
    if (!this.cachedToken) {
      const oldToken = process.env.BOOK_TOKEN ?? (await this.getTokenBrowser());
      this.cachedToken = await this.fetchToken(oldToken);
    }
    return this.cachedToken;
  }
}
