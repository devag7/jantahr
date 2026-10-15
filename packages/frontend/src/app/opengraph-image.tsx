import { ImageResponse } from 'next/og';
import { OG_SIZE, OgCard, OgChip, ogFonts } from './_og/card';

export const alt = 'JantaHR: payroll that keeps up with Indian law';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Share card for the home page (and any page without its own). */
export default async function Image() {
  return new ImageResponse(
    <OgCard title={['Payroll that keeps up', 'with Indian law.']} lead="PF, ESI, TDS, professional tax and labour-code wages calculated every month, with every filing deadline on one calendar.">
      <OgChip strong>HRMS and payroll for India</OgChip><OgChip>Data hosted in India</OgChip><OgChip>Open source, AGPL-3.0</OgChip>
    </OgCard>,
    { ...size, fonts: await ogFonts() },
  );
}
