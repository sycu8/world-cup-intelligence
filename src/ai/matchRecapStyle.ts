import { isLikelyVietnamese } from '../services/newsTranslationUtils';

/** FIFA literal / machine-translation patterns we want to replace with broadcast Vietnamese. */
const STIFF_ENGLISH_FRAGMENTS =
  /\b(attempts an effort on goal|committed foul|Start Time|End Time|End of match|Coin Toss|Goal prevention|denies a clear goalscoring|sent off for|booked for|Full time\.|Half time\.)\b/i;

const STIFF_SUMMARY_FRAGMENTS =
  /\b(beat \w|drew \d|Possession \d|Group [A-L]\)| at [A-Z])/i;

export const COMMENTATOR_SYSTEM = `Bạn là bình luận viên bóng đá World Cup trên truyền hình Việt Nam.
Viết tiếng Việt tự nhiên, dễ nghe, có đủ dấu. Giữ nguyên tên cầu thủ và tên đội tuyển.
Không dịch word-by-word từ tiếng Anh. Không bịa thêm sự kiện ngoài nguồn.
Giọng bình luận: gọn, sống động, như K+ / VTV thể thao.`;

export const SUMMARY_USER_PROMPT = (summaryEn: string) =>
  `Viết tóm tắt trận 3–5 câu theo phong cách bình luận viên:
- Câu mở: kết quả + bảng/vòng + sân (nếu có)
- 1–2 câu: diễn biến chính (ai ghi bàn phút nào, thẻ, VAR)
- Câu cuối (tuỳ chọn): kiểm soát bóng hoặc nhận xét ngắn

Ví dụ giọng điệu:
"Mexico thắng 2-0 trước Nam Phi tại Estadio Azteca — trận khai mạc World Cup 2026. Julián Quiñones mở tỷ số phút 9 sau sai lầm của Sphephelo Sithole; Raúl Jiménez ghi thêm bàn đầu đánh đầu phút 67."

Nguồn tiếng Anh:
${summaryEn.slice(0, 850)}

JSON: { "textVi": "..." }`;

export function commentaryUserPrompt(textEn: string, eventType: string | null, minute: number | null): string {
  const minuteBit = minute != null ? `Phút ${minute}. ` : '';
  const styleHint = eventStyleHint(eventType);
  return `${minuteBit}${styleHint}

Câu gốc (FIFA):
${textEn.slice(0, 520)}

Viết MỘT câu tường thuật tiếng Việt (có thể thêm emoji ⚽🟨🟥 khi phù hợp).
JSON: { "textVi": "..." }`;
}

function eventStyleHint(eventType: string | null): string {
  switch (eventType) {
    case 'goal':
      return 'Sự kiện: BÀN THẮNG. Mở đầu "⚽ BÀN THẮNG!" hoặc "VÀO!" — nêu cầu thủ, cách ghi bàn, tỷ số.';
    case 'own_goal':
      return 'Sự kiện: phản lưới nhà. Dùng "⚽ BÀN THẮNG (phản lưới nhà)!"';
    case 'penalty_goal':
      return 'Sự kiện: penalty. "⚽ BÀN THẮNG từ penalty!"';
    case 'kickoff':
      return 'Sự kiện: khai cuộc. Ví dụ: "Khai cuộc — Brazil đối đầu Morocco tại bảng C."';
    case 'half_time':
      return 'Sự kiện: hết hiệp một. Ví dụ: "Hết hiệp một: Brazil 1-0 Morocco. Chủ động hơn về thế trận."';
    case 'full_time':
      return 'Sự kiện: kết thúc. Ví dụ: "Kết thúc: Brazil 1-1 Morocco — hai đội chia điểm sau trận mở màn hấp dẫn."';
    case 'yellow_card':
      return 'Sự kiện: thẻ vàng. "🟨 [Cầu thủ] (đội) nhận thẻ vàng — [lý do ngắn]."';
    case 'red_card':
    case 'second_yellow':
      return 'Sự kiện: thẻ đỏ. "🟥 Thẻ đỏ! [Cầu thủ] (đội) — [lý do ngắn]."';
    case 'substitution':
      return 'Sự kiện: thay người. "[Cầu thủ vào] thay [cầu thủ ra] bên phía [đội]."';
    case 'var':
      return 'Sự kiện: VAR. Nêu rõ bàn bị hủy / được công nhận / đang xem lại.';
    case 'shot':
    case 'save':
      return 'Sự kiện: cơ hội hoặc cứu thua. Mô tả sút xa/đánh đầu/cản phá ngắn gọn.';
    default:
      return 'Viết như bình luận viên tường thuật trực tiếp, dễ hiểu với khán giả Việt.';
  }
}

/** True when cached Vietnamese still reads like FIFA machine text, not broadcast copy. */
export function needsBroadcastStyleRefresh(textVi: string, textEn?: string): boolean {
  const value = textVi.trim();
  if (!value) return true;
  if (textEn && value.toLowerCase() === textEn.trim().toLowerCase()) return true;
  if (!isLikelyVietnamese(value, textEn)) return true;
  if (STIFF_ENGLISH_FRAGMENTS.test(value)) return true;
  if (STIFF_SUMMARY_FRAGMENTS.test(value)) return true;
  if (textEn && /\bGOAL!?\b/i.test(textEn) && !/\b(BÀN THẮNG|VÀO!)\b/i.test(value)) return true;
  if (textEn && /\bred card\b/i.test(textEn) && !/\b(thẻ đỏ|🟥)\b/i.test(value)) return true;
  if (textEn && /\byellow card\b/i.test(textEn) && !/\b(thẻ vàng|🟨)\b/i.test(value)) return true;
  return false;
}
