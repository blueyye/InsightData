
import { Language, Translation } from './types';

export const TRANSLATIONS: Record<Language, Translation> = {
  en: {
    title: "DataInsight",
    subtitle: "Advanced Data Analysis Suite",
    uploadArea: "Click or drag to upload files",
    uploadHint: "Supports .csv, .txt, .xlsx",
    statsTitle: "Statistical Indicators",
    vizTitle: "Data Visualization",
    dataTitle: "Data Preview",
    aiInsight: "Get AI Insights",
    aiAnalyzing: "AI is analyzing...",
    mean: "Mean",
    median: "Median",
    variance: "Variance",
    stdDev: "Std. Deviation",
    min: "Min",
    max: "Max",
    count: "Count",
    correlation: "Correlation Matrix",
    footerCredits: "Produced by DaKES Institute • Author: Fred Y. Ye (叶鹰)",
    noData: "Please upload data to start analysis",
    exportCsv: "Export to CSV"
  },
  cn: {
    title: "DataInsight 洞见数据",
    subtitle: "高级数据分析套件",
    uploadArea: "点击或拖拽上传文件",
    uploadHint: "支持 .csv, .txt, .xlsx 格式",
    statsTitle: "统计指标",
    vizTitle: "数据可视化",
    dataTitle: "数据预览",
    aiInsight: "获取 AI 洞察",
    aiAnalyzing: "AI 正在分析中...",
    mean: "均值",
    median: "中位数",
    variance: "方差",
    stdDev: "标准差",
    min: "最小值",
    max: "最大值",
    count: "样本数",
    correlation: "相关系数矩阵",
    footerCredits: "制作：DaKES Institute • 作者：Fred Y. Ye (叶鹰)",
    noData: "请上传数据以开始分析",
    exportCsv: "导出为 CSV"
  }
};
