import fontUrl from '@/assets/fonts/DejaVuSans.ttf?url';
import { analyticsExportFilename, type AnalyticsExportDocument } from '@shared/analytics-export';

let font: Promise<string> | undefined;
const asBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error('The export asset could not be read'));
  reader.readAsDataURL(blob);
});
async function loadFont() {
  if (!font) font = fetch(fontUrl).then(async res => { if (!res.ok) throw new Error('The report font could not be loaded'); return asBase64(await res.blob()); }).catch(error => { font = undefined; throw error; });
  return font;
}
async function loadLogo(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const image = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160;
    const context = canvas.getContext('2d');
    if (!context) { image.close(); return undefined; }
    context.drawImage(image, 0, 0, 160, 160); image.close();
    return canvas.toDataURL('image/png');
  } catch { return undefined; } // Academy text branding remains if the logo is unavailable.
}
export async function downloadAnalyticsExport(doc: AnalyticsExportDocument, format: 'xlsx' | 'pdf', logoUrl: string) {
  const { buildAnalyticsWorkbook, buildAnalyticsPdf } = await import('./analytics-export-files');
  let blob: Blob;
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    blob = new Blob([XLSX.write(buildAnalyticsWorkbook(doc), { type: 'array', bookType: 'xlsx', compression: true })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } else {
    const [fontData, logoData] = await Promise.all([loadFont(), loadLogo(logoUrl)]);
    blob = buildAnalyticsPdf(doc, fontData, logoData).output('blob');
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = analyticsExportFilename(doc, format); document.body.appendChild(link); link.click(); link.remove();
  // Allow the browser to consume the blob before releasing it, including mobile.
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
