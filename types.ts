
export interface DataPoint {
  [key: string]: string | number | null;
}

export interface StatisticalSummary {
  columnName: string;
  mean: number | null;
  median: number | null;
  variance: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export interface CorrelationMatrix {
  [key: string]: {
    [key: string]: number;
  };
}

export type Language = 'en' | 'cn';

export interface Translation {
  title: string;
  subtitle: string;
  uploadArea: string;
  uploadHint: string;
  statsTitle: string;
  vizTitle: string;
  dataTitle: string;
  aiInsight: string;
  aiAnalyzing: string;
  mean: string;
  median: string;
  variance: string;
  stdDev: string;
  min: string;
  max: string;
  count: string;
  correlation: string;
  footerCredits: string;
  noData: string;
  exportCsv: string;
}
