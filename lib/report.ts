import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ScenarioResult } from "./types";

export async function createScenarioPdf(name: string, result: ScenarioResult) {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.035, 0.075, 0.14);
  const cyan = rgb(0.04, 0.72, 0.9);
  const muted = rgb(0.37, 0.43, 0.5);

  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.96, 0.98, 0.99) });
  page.drawRectangle({ x: 0, y: 690, width: 595, height: 152, color: navy });
  page.drawText("ECHO CITY / BISHKEK", { x: 42, y: 790, size: 11, font: bold, color: cyan });
  page.drawText("URBAN SCENARIO REPORT", { x: 42, y: 742, size: 26, font: bold, color: rgb(1, 1, 1) });
  page.drawText(name.replace(/[^\x20-\x7E]/g, "").slice(0, 70) || "Saved scenario", { x: 42, y: 712, size: 12, font: regular, color: rgb(0.78, 0.84, 0.9) });

  page.drawText(`Confidence  ${result.confidence}%`, { x: 42, y: 648, size: 14, font: bold, color: navy });
  page.drawText(`Generated  ${new Date(result.generatedAt).toISOString().replace("T", " ").slice(0, 16)} UTC`, { x: 310, y: 648, size: 10, font: regular, color: muted });

  let y = 596;
  page.drawText("IMPACT SUMMARY", { x: 42, y, size: 11, font: bold, color: muted });
  y -= 30;
  result.metrics.forEach((metric, index) => {
    const x = index % 2 === 0 ? 42 : 304;
    const rowY = y - Math.floor(index / 2) * 72;
    page.drawRectangle({ x, y: rowY - 36, width: 228, height: 58, color: rgb(1, 1, 1), borderColor: rgb(0.87, 0.9, 0.92), borderWidth: 1 });
    page.drawText(metric.key.toUpperCase(), { x: x + 14, y: rowY + 4, size: 9, font: bold, color: muted });
    page.drawText(`${metric.before} > ${metric.after} ${metric.unit.replace(/[^\x20-\x7E]/g, "")}`, { x: x + 14, y: rowY - 20, size: 14, font: bold, color: metric.favorable ? rgb(0.05, 0.55, 0.36) : rgb(0.82, 0.25, 0.22) });
  });

  y -= 238;
  page.drawText("AFFECTED CORRIDORS", { x: 42, y, size: 11, font: bold, color: muted });
  y -= 28;
  result.affectedCorridors.slice(0, 5).forEach((corridor) => {
    const safeName = corridor.name.replace(/[^\x20-\x7E]/g, "Road corridor");
    page.drawText(safeName, { x: 42, y, size: 10, font: regular, color: navy });
    page.drawText(`${corridor.loadBefore}%  >  ${corridor.loadAfter}%`, { x: 420, y, size: 10, font: bold, color: cyan });
    y -= 24;
  });

  page.drawLine({ start: { x: 42, y: 98 }, end: { x: 553, y: 98 }, thickness: 1, color: rgb(0.84, 0.88, 0.91) });
  page.drawText("Illustrative model. Not an official engineering calculation.", { x: 42, y: 76, size: 9, font: regular, color: muted });
  page.drawText("echo.city / MVP", { x: 455, y: 76, size: 9, font: bold, color: muted });

  return document.save();
}

