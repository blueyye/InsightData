
import { DataPoint, StatisticalSummary, CorrelationMatrix } from '../types';

export const parseNumber = (val: any): number | null => {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
};

export const calculateStats = (data: DataPoint[], columns: string[]): StatisticalSummary[] => {
  return columns.map(col => {
    const values = data
      .map(row => parseNumber(row[col]))
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      return {
        columnName: col,
        mean: null,
        median: null,
        variance: null,
        stdDev: null,
        min: null,
        max: null,
        count: 0
      };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 
      : sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      columnName: col,
      mean,
      median,
      variance,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  });
};

export const calculateCorrelation = (data: DataPoint[], columns: string[]): CorrelationMatrix => {
  const matrix: CorrelationMatrix = {};
  
  const numericData: Record<string, number[]> = {};
  columns.forEach(col => {
    numericData[col] = data.map(r => parseNumber(r[col])).filter((v): v is number => v !== null);
  });

  columns.forEach(col1 => {
    matrix[col1] = {};
    columns.forEach(col2 => {
      const v1 = data.map(r => parseNumber(r[col1]));
      const v2 = data.map(r => parseNumber(r[col2]));
      
      const pairs = v1.map((val, idx) => [val, v2[idx]]).filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
      
      if (pairs.length < 2) {
        matrix[col1][col2] = 1;
        return;
      }

      const m1 = pairs.reduce((a, b) => a + b[0], 0) / pairs.length;
      const m2 = pairs.reduce((a, b) => a + b[1], 0) / pairs.length;

      const num = pairs.reduce((a, b) => a + (b[0] - m1) * (b[1] - m2), 0);
      const den1 = Math.sqrt(pairs.reduce((a, b) => a + Math.pow(b[0] - m1, 2), 0));
      const den2 = Math.sqrt(pairs.reduce((a, b) => a + Math.pow(b[1] - m2, 2), 0));

      matrix[col1][col2] = den1 * den2 === 0 ? 0 : num / (den1 * den2);
    });
  });

  return matrix;
};
