export interface SemesterPhase {
  semester_phase: string;
  semester_phase_str: string;
  semester_phase_code: string;
}
export interface GradeSemester {
  grade_level: string;
  grade_level_code: string;
  grade_level_str: string;
  used_semester_phases: SemesterPhase[];
}
export interface BookData {
  uuid: string;
  file_path: string;
  file_md5: string;
  title: string;
  cover_path: string;
  is_current_term: boolean;
  use_year: string;
  text_start_page: number;
  short_title: string;
  update_time: string;
  subject: string;
  grade: string;
  term: string;
  use_type: string;
  isbn: string;
  status: string;
  subject_str: string;
  textbook_material_type: string | undefined;
  publisher: string | undefined;
  used_grade_semesters: GradeSemester[];
}

export interface ManifestPageSize {
  $: {
    pageNo: string;
    width: string;
    height: string;
  };
}
export interface ManifestMain {
  $: {
    id: string;
    src: string;
    srctype: string;
    digestMethod?: string;
    digest?: string;
    currentPageNo?: string;
    isbn?: string;
  };
  pageSizes?: {
    $: {
      count: string;
    };
    pageSize: ManifestPageSize[];
  }[];
}
export interface ManifestAttachment {
  $: {
    id: string;
    src: string;
    srctype: string;
    name: string;
    digestMethod: string;
  };
}
export interface ManifestElement {
  $: {
    id: string;
    src: string;
    srctype: string;
  };
}
export interface Manifest {
  manifest: {
    metainfo: {
      times: any[];
      author: {
        $: {
          name: string;
        };
      }[];
    }[];
    main: ManifestMain[];
    attachments: { attachment: ManifestAttachment[] }[];
    relations?: ManifestElement[];
    tags?: ManifestElement[];
    comments?: ManifestElement[];
    regions?: ManifestElement[];
  };
}
