import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { BookData, Manifest } from "./types.js";
import { getConfig, validateConfig } from "./config.js";
import pLimit from "p-limit";
import { decryptPdf } from "./decrypt.js";
import { copyFile, writeFile } from "fs/promises";
import { parseStringPromise } from "xml2js";

export class BookProcessor {
  private config = getConfig();
  private dataJson: { data: BookData[] };
  private fetchJson: Record<string, string>;

  constructor() {
    const configErrors = validateConfig(this.config);
    if (configErrors.length > 0) {
      throw new Error(`配置验证失败: ${configErrors.join(", ")}`);
    }
    try {
      this.dataJson = JSON.parse(
        readFileSync(this.config.paths.dataFile, "utf-8")
      );
      console.log(`加载 ${this.dataJson.data.length} 本书籍`);

      this.fetchJson = JSON.parse(
        readFileSync(this.config.paths.passwordFile, "utf-8")
      );
      console.log(`加载 ${Object.keys(this.fetchJson).length} 个密码`);
    } catch (error) {
      throw new Error(`加载数据文件失败: ${error}`);
    }
  }

  private async processBook(bookData: BookData): Promise<void> {
    const {
      uuid,
      file_md5,
      title,
      subject_str,
      term,
      use_year,
      grade,
      use_type,
      publisher,
    } = bookData;

    const password = this.fetchJson[uuid];
    if (!password) {
      throw new Error(`找不到密码`);
    }
    const bookDir = join(this.config.paths.inputDir, file_md5);
    const manifest = (await parseStringPromise(
      readFileSync(join(bookDir, "Manifest.xml"), "utf-8")
    )) as Manifest;
    const bookOutputDir = join(
      this.config.paths.outputDir,
      {
        FIRST_GRADE: "01_一年级",
        SECOND_GRADE: "02_二年级",
        THIRD_GRADE: "03_三年级",
        FOURTH_GRADE: "04_四年级",
        FIFTH_GRADE: "05_五年级",
        SIXTH_GRADE: "06_六年级",
        SEVENTH_GRADE: "07_七年级",
        EIGHTH_GRADE: "08_八年级",
        NINTH_GRADE: "09_九年级",
        TENTH_GRADE: "10_高一",
        ELEVENTH_GRADE: "11_高二",
        TWELFTH_GRADE: "12_高三",
        PRIMARY_PHASE: "13_小学阶段",
        JUNIOR_PHASE: "14_初中阶段",
        SENIOR_PHASE: "15_高中阶段",
      }[grade] || "未知",
      {
        ALL: "全学年",
        FIRST_SEMESTER: "01_上学期",
        SECOND_SEMESTER: "02_下学期",
      }[term] || "未知",
      subject_str,
      (publisher &&
        {
          SHJY: "上海教育出版社",
          SHWJ: "上海外语教育出版社",
          ZGDT: "中国地图出版社",
          ZHDT: "中华地图学社",
          SHKJ: "上海科技教育出版社",
          HDSD: "华东师范大学出版社",
          SHSH: "上海书画出版社",
          SHYD: "上海远东出版社",
          SNET: "少年儿童出版社",
          SHYY: "上海音乐出版社",
          RJVV: "人民教育出版社",
          SHCS: "上海辞书出版社",
        }[publisher]) ||
        "未知",
      {
        XSYS: "学生用书",
        LXC: "练习册",
        HDSC: "活动手册",
        SYC: "实验册",
        JSYS: "教师用书",
      }[use_type] || "未知"
    );
    const attachmentsDir = join(bookDir, "attachments");
    const attachmentOutputDir = join(
      bookOutputDir,
      `${use_year}_${title}_附件`
    );
    if (!existsSync(attachmentOutputDir)) {
      mkdirSync(attachmentOutputDir, { recursive: true });
    }

    const tasks = [
      decryptPdf(
        join(bookDir, `${uuid}.pdf`),
        join(bookOutputDir, `${use_year}_${title}.pdf`),
        password
      ),
      writeFile(
        join(bookOutputDir, `${use_year}_${title}.json`),
        JSON.stringify(bookData, null, 2),
        "utf-8"
      ),
    ];
    const attachments = manifest.manifest.attachments?.[0]?.attachment || [];
    for (const attachment of attachments) {
      const fromFile = join(attachmentsDir, attachment.$.src);
      const baseName = attachment.$.name.replace(/[/\\?%*:|"<>]/g, "_");
      const toFile = join(
        attachmentOutputDir,
        `${baseName}_${basename(fromFile)}`
      );
      tasks.push(copyFile(fromFile, toFile));
    }
    const results = await Promise.allSettled(tasks);
    const errors = results
      .map((result, index) =>
        result.status === "rejected"
          ? { error: result.reason, task: `task${index + 1}` }
          : null
      )
      .filter((error): error is { error: any; task: string } => error !== null);
    if (errors.length > 0) {
      const errorMessages = errors
        .map((e) => `${e.task}: ${e.error.message || e.error}`)
        .join("; ");
      throw new Error(`部分任务失败: ${errorMessages}`);
    }
  }

  async processAll(): Promise<void> {
    const limit = pLimit(this.config.concurrency);
    let completed = 0;
    let failed = 0;
    const total = this.dataJson.data.length;
    await Promise.all(
      this.dataJson.data.map((bookData) =>
        limit(async () => {
          try {
            await this.processBook(bookData);
            completed++;
          } catch (error) {
            failed++;
            console.error(
              `\x1b[31m${bookData.uuid} ${bookData.title} 失败: ${
                (error as Error).message
              }\x1b[0m`
            );
          }
          console.log(
            `${(((completed + failed) / total) * 100).toFixed(
              2
            )}% \x1b[32m${completed} \x1b[31m${failed} \x1b[0m${bookData.title}`
          );
        })
      )
    );
  }
}
