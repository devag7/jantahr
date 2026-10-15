import { ImageResponse } from 'next/og';
import { PLANS, formatRupees } from '@/lib/plans';
import { OG_SIZE, OgCard, OgChip, ogFonts } from '../../_og/card';

export const alt = 'JantaHR pricing: per-employee plans in rupees';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Share card for /pricing, with the prices read from the plan catalogue. */
export default async function Image() {
  return new ImageResponse(
    <OgCard title={['Pay per employee.']} lead="Prices per employee a month, billed yearly. Every plan includes leave, attendance, self-service and the DPDP privacy tools.">
      {PLANS.map((p) => (
        <OgChip key={p.key} strong={p.key === 'PROFESSIONAL'}>
          {`${p.name} ${p.pricePaise ? formatRupees(p.pricePaise.ANNUAL) : 'custom'}`}
        </OgChip>
      ))}
    </OgCard>,
    { ...size, fonts: await ogFonts() },
  );
}
