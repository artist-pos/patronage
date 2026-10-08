/** What a reviewer sees of one application. Deliberately excludes status, files for delivery, and invoices. */
export interface ReviewWork {
  id: string;
  url: string;
  title: string | null;
  /** The artist's description, or the one they wrote for this application. */
  description: string | null;
}

export interface ReviewAnswer {
  label: string;
  text: string | null;
  files: string[];
}

export interface ReviewApp {
  id: string;
  name: string;
  username: string | null;
  location: string | null;
  careerStage: string | null;
  medium: string[];
  statement: string | null;
  cvUrl: string | null;
  works: ReviewWork[];
  answers: ReviewAnswer[];
}

export interface ReviewCriterionDTO {
  id: string;
  label: string;
  helper: string | null;
  weight: number;
  scaleMax: number;
}
