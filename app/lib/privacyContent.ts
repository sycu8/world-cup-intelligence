export const privacySections = [
  {
    id: 'overview',
    title: { vi: 'Tổng quan', en: 'Overview' },
    body: {
      vi: 'PitchIntel (“ứng dụng”, “chúng tôi”) cung cấp phân tích chiến thuật và xác suất mô hình cho FIFA World Cup 2026. Ứng dụng di động và website wcstat.orangecloud.vn là cùng một dịch vụ. Chúng tôi không cung cấp dịch vụ cá cược, không nhận cược và không khuyến khích đặt cược.',
      en: 'PitchIntel (“the app”, “we”) provides tactical analysis and model probabilities for FIFA World Cup 2026. The mobile apps and wcstat.orangecloud.vn website are the same service. We do not offer gambling, accept wagers, or encourage betting.',
    },
  },
  {
    id: 'data-collected',
    title: { vi: 'Dữ liệu chúng tôi xử lý', en: 'Data we process' },
    body: {
      vi: 'PitchIntel không yêu cầu tài khoản đăng nhập. Dữ liệu lưu trên thiết bị của bạn (ví dụ danh sách trận/đội yêu thích trong localStorage) không được gửi lên máy chủ của chúng tôi trừ khi bạn chủ động dùng tính năng cần API.',
      en: 'PitchIntel does not require a login account. Data stored on your device (for example favorite matches/teams in localStorage) is not sent to our servers unless you use features that call our API.',
    },
    bullets: [
      {
        vi: 'Yêu cầu API: địa chỉ IP, user-agent, tham số truy vấn (trận, đội, tin) — cần thiết để phục vụ nội dung.',
        en: 'API requests: IP address, user-agent, query parameters (match, team, news) — required to serve content.',
      },
      {
        vi: 'Nhật ký vận hành ngắn hạn trên Cloudflare Workers để bảo mật và khắc phục sự cố.',
        en: 'Short-term operational logs on Cloudflare Workers for security and incident response.',
      },
      {
        vi: 'Chúng tôi không bán dữ liệu cá nhân và không dùng dữ liệu cho quảng cáo nhắm mục tiêu.',
        en: 'We do not sell personal data and do not use data for targeted advertising.',
      },
    ],
  },
  {
    id: 'third-party',
    title: { vi: 'Dịch vụ bên thứ ba', en: 'Third-party services' },
    body: {
      vi: 'Ứng dụng có thể tải tài nguyên hoặc dữ liệu công khai từ các nguồn sau. Mỗi bên có chính sách riêng:',
      en: 'The app may load assets or public data from the sources below. Each party has its own policy:',
    },
    bullets: [
      { vi: 'Cloudflare — lưu trữ và API (cloudflare.com/privacypolicy).', en: 'Cloudflare — hosting and API (cloudflare.com/privacypolicy).' },
      { vi: 'Google Fonts — typography (policies.google.com/privacy).', en: 'Google Fonts — typography (policies.google.com/privacy).' },
      { vi: 'flagcdn.com — ảnh cờ quốc gia.', en: 'flagcdn.com — country flag images.' },
      { vi: 'Nguồn tin công khai (RSS / FIFA / báo chí) — liên kết ngoài tới bài gốc.', en: 'Public news sources (RSS / FIFA / press) — external links to original articles.' },
    ],
  },
  {
    id: 'children',
    title: { vi: 'Trẻ em', en: 'Children' },
    body: {
      vi: 'Dịch vụ hướng tới người hâm mộ bóng đá nói chung, không nhắm vào trẻ em dưới 13 tuổi. Chúng tôi không cố ý thu thập thông tin cá nhân từ trẻ em.',
      en: 'The service is aimed at football fans in general and is not directed at children under 13. We do not knowingly collect personal information from children.',
    },
  },
  {
    id: 'retention',
    title: { vi: 'Lưu trữ & bảo mật', en: 'Retention & security' },
    body: {
      vi: 'Dữ liệu máy chủ (xác suất, lịch, tin) được lưu trong cơ sở dữ liệu Cloudflare D1 và bộ nhớ đệm theo chu kỳ cập nhật giải đấu. Chúng tôi áp dụng HTTPS, giới hạn quyền truy cập vận hành và không lưu thẻ thanh toán (ứng dụng miễn phí).',
      en: 'Server data (probabilities, schedule, news) is stored in Cloudflare D1 and caches according to tournament update cycles. We use HTTPS, restrict operational access, and do not store payment cards (the app is free).',
    },
  },
  {
    id: 'rights',
    title: { vi: 'Quyền của bạn', en: 'Your rights' },
    body: {
      vi: 'Bạn có thể xóa dữ liệu cục bộ bằng cách gỡ cài đặt ứng dụng hoặc xóa dữ liệu trình duyệt/ứng dụng. Để yêu cầu về dữ liệu máy chủ, liên hệ qua email bên dưới.',
      en: 'You can delete on-device data by uninstalling the app or clearing app/browser storage. For server-side data requests, contact us using the email below.',
    },
  },
  {
    id: 'changes',
    title: { vi: 'Thay đổi chính sách', en: 'Policy changes' },
    body: {
      vi: 'Chúng tôi có thể cập nhật chính sách này. Ngày hiệu lực được ghi ở đầu trang. Tiếp tụd sử dụng dịch vụ sau khi cập nhật đồng nghĩa với chấp nhận phiên bản mới.',
      en: 'We may update this policy. The effective date is shown at the top of this page. Continued use after updates means you accept the new version.',
    },
  },
  {
    id: 'contact',
    title: { vi: 'Liên hệ', en: 'Contact' },
    body: {
      vi: 'PitchIntel / World Cup Intelligence — Lê Sỹ Cường. Email: privacy@orangecloud.vn · Website: https://wcstat.orangecloud.vn/privacy',
      en: 'PitchIntel / World Cup Intelligence — Cuong Le Sy. Email: privacy@orangecloud.vn · Website: https://wcstat.orangecloud.vn/privacy',
    },
  },
] as const;

export const privacyEffectiveDate = '2026-06-14';

export function pickPrivacy<T extends { vi: string; en: string }>(block: T, mode: 'vi' | 'en'): string {
  return mode === 'en' ? block.en : block.vi;
}
