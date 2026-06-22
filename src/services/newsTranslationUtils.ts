export type NewsDocRow = {
  id: string;
  title: string;
  summary: string;
  title_vi: string | null;
  summary_vi: string | null;
  source_url?: string;
  source_name?: string;
};

const VI_DIACRITICS =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

export function isLikelyVietnamese(text: string, englishRef?: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (englishRef && value.toLowerCase() === englishRef.trim().toLowerCase()) return false;
  if (VI_DIACRITICS.test(value)) return true;
  const viHints =
    /\b(giá|vé|trận|đội|bóng đá|vòng|bảng|tuyển|huấn luyện|cầu thủ|thắng|thua|hòa|tóm tắt|đang|người|năm|trong|cho|với|của)\b/i;
  return viHints.test(value) && value.length >= 12 && !/^[a-z0-9\s\?,\.'"-]+$/i.test(value);
}

export function needsNewsTranslation(row: NewsDocRow): boolean {
  const titleVi = row.title_vi?.trim() ?? '';
  const summaryVi = row.summary_vi?.trim() ?? '';
  if (!titleVi || !summaryVi) return true;
  if (!isLikelyVietnamese(titleVi, row.title)) return true;
  if (!isLikelyVietnamese(summaryVi, row.summary)) return true;
  return false;
}

export function resolvePublisherLabel(row: Pick<NewsDocRow, 'source_url' | 'source_name'>): string {
  const name = row.source_name?.trim();
  if (name && name !== 'Mock Development Source') return name;
  const url = (row.source_url ?? '').toLowerCase();
  if (url.includes('bbc.') || url.includes('bbci.')) return 'BBC';
  if (url.includes('theguardian.')) return 'The Guardian';
  if (url.includes('fifa.')) return 'FIFA';
  if (url.includes('vnexpress.')) return 'VnExpress';
  return name || 'RSS';
}
