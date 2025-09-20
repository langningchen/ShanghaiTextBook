import { multiselect, select } from "@clack/prompts";
import { BookData } from "./types";

export class Selector {
  private static readonly GRADE_MAP: Record<string, string> = {
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
  };
  private static readonly TERM_MAP: Record<string, string> = {
    ALL: "全学年",
    FIRST_SEMESTER: "01_上学期",
    SECOND_SEMESTER: "02_下学期",
  };
  private static readonly PUBLISHER_MAP: Record<string, string> = {
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
  };
  private static readonly USE_TYPE_MAP: Record<string, string> = {
    XSYS: "学生用书",
    LXC: "练习册",
    HDSC: "活动手册",
    SYC: "实验册",
    JSYS: "教师用书",
  };

  private static filterBooks(
    data: BookData[],
    filters: Record<string, string[]>,
    dimensionNames: { key: string; name: string; map: Record<string, string> }[]
  ): BookData[] {
    return data.filter((book) =>
      dimensionNames.every((dim) => {
        const vals = filters[dim.key];
        if (!vals || vals.length === 0) return true;
        return vals.includes((book as any)[dim.key] ?? "");
      })
    );
  }

  private static getActualValues(data: BookData[], key: string): string[] {
    return Array.from(new Set(data.map((book) => (book as any)[key] ?? "")));
  }

  private static getOtherValues(
    actualValues: string[],
    map: Record<string, string>
  ): string[] {
    return actualValues.filter((v) => !(v in map));
  }

  private static buildOptions(
    dim: { key: string; name: string; map: Record<string, string> },
    booksData: BookData[],
    filters: Record<string, string[]>,
    dimensionNames: {
      key: string;
      name: string;
      map: Record<string, string>;
    }[],
    otherValues: string[],
    otherCount: number
  ) {
    const optionCounts: Record<string, number> = {};
    for (const [value] of Object.entries(dim.map)) {
      optionCounts[value] = Selector.filterBooks(
        booksData,
        { ...filters, [dim.key]: [value] },
        dimensionNames
      ).length;
    }
    return [
      ...Object.entries(dim.map).map(([value, label]) => ({
        value,
        label: `${label}（${optionCounts[value]}）`,
      })),
      ...(otherValues.length > 0
        ? [{ value: "other", label: `其他（${otherCount}）` }]
        : []),
    ];
  }

  private static buildInitialValues(
    filters: Record<string, string[]>,
    dimKey: string,
    options: { value: string; label: string }[],
    otherValues: string[]
  ) {
    let initialValues = filters[dimKey] || options.map((o) => o.value);
    if (filters[dimKey]) {
      const hasOther = filters[dimKey].some((v) => otherValues.includes(v));
      if (hasOther && !initialValues.includes("other")) {
        initialValues = [...initialValues, "other"];
      }
    }
    return initialValues;
  }

  private static resolveSelected(
    selected: string[],
    otherValues: string[]
  ): string[] {
    if (selected.includes("other")) {
      return [...selected.filter((v) => v !== "other"), ...otherValues];
    }
    return selected;
  }

  private static buildDimChoices(
    dimensionNames: {
      key: string;
      name: string;
      map: Record<string, string>;
    }[],
    filters: Record<string, string[]>
  ) {
    return dimensionNames.map((dim) => {
      const allValues = Object.keys(dim.map);
      const selectedValues = filters[dim.key] || [];
      const isAllSelected =
        selectedValues.length === 0 ||
        selectedValues.length === allValues.length;
      return {
        value: dim.key,
        label:
          !isAllSelected && selectedValues.length > 0
            ? `${dim.name}（已选: ${selectedValues
                .map((v) => dim.map[v] || v)
                .join(",")})`
            : dim.name,
      };
    });
  }

  static async select(booksData: BookData[]): Promise<BookData[]> {
    let filters: Record<string, string[]> = {};
    let filtered = booksData;
    const dimensionNames = [
      { key: "grade", name: "选择年级", map: Selector.GRADE_MAP },
      { key: "term", name: "选择学期", map: Selector.TERM_MAP },
      {
        key: "subject",
        name: "选择学科",
        map: booksData.reduce((acc, book) => {
          const { subject, subject_str } = book;
          if (subject && !acc[subject]) {
            acc[subject] = subject_str;
          }
          return acc;
        }, {} as Record<string, string>),
      },
      { key: "publisher", name: "选择出版社", map: Selector.PUBLISHER_MAP },
      { key: "use_type", name: "选择类型", map: Selector.USE_TYPE_MAP },
      {
        key: "use_year",
        name: "选择学年",
        map: booksData.reduce((acc, book) => {
          const { use_year } = book;
          if (use_year && !acc[use_year]) {
            acc[use_year] = use_year;
          }
          return acc;
        }, {} as Record<string, string>),
      },
    ];

    while (true) {
      const dimChoices = Selector.buildDimChoices(dimensionNames, filters);
      dimChoices.push({ value: "done", label: "完成筛选" });
      const dimKey = await select({
        message: `选择筛选维度，当前筛选结果数量: ${filtered.length}`,
        options: dimChoices,
      });
      if (dimKey === "done") break;

      const dim = dimensionNames.find((d) => d.key === dimKey)!;
      const actualValues = Selector.getActualValues(booksData, dim.key);
      const otherValues = Selector.getOtherValues(actualValues, dim.map);
      let otherCount = 0;
      if (otherValues.length > 0) {
        otherCount = Selector.filterBooks(
          booksData,
          { ...filters, [dim.key]: otherValues },
          dimensionNames
        ).length;
      }
      const options = Selector.buildOptions(
        dim,
        booksData,
        filters,
        dimensionNames,
        otherValues,
        otherCount
      );
      const initialValues = Selector.buildInitialValues(
        filters,
        dim.key,
        options,
        otherValues
      );
      const selected = await multiselect({
        message: dim.name,
        options,
        initialValues,
      });
      if (!selected || typeof selected === "symbol") {
        throw new Error("User cancelled the input");
      }
      filters[dim.key] = Selector.resolveSelected(selected, otherValues);
      filtered = Selector.filterBooks(booksData, filters, dimensionNames);
    }
    return filtered;
  }
}
