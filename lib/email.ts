export interface ReportEmailConfig {
  apiKey?: string;
  from?: string;
}

export interface ReportEmailInput {
  recipient: string;
  reportId: string;
  requestUrl: string;
}

export type EmailTransport = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function sendReportEmail(
  input: ReportEmailInput,
  config: ReportEmailConfig,
  transport: EmailTransport = fetch,
) {
  if (!config.apiKey) return { sent: false, reason: "email_not_configured" as const };
  const url = new URL(`/api/reports/${input.reportId}/download`, input.requestUrl).toString();
  const response = await transport("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: config.from ?? "ECHO CITY <reports@echo-city.app>",
      to: [input.recipient],
      subject: "ECHO CITY — отчёт по городскому сценарию",
      html: `<p>Отчёт готов.</p><p><a href="${url}">Скачать PDF</a></p><p>Ссылка доступна 30 дней.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Email delivery failed: ${response.status}`);
  return { sent: true as const };
}
