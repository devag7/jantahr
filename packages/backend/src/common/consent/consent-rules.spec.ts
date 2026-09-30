import { breachBoardDeadline, NOTICE_VERSION, planErasure, requestDueDate, resolveConsents, isConsentPurpose, KYC_DOCUMENT_TYPE } from './consent-rules';

const at = (s: string) => new Date(s);

describe('resolveConsents', () => {
  it('reports NOT_ASKED when nothing is recorded', () => {
    const r = resolveConsents([]);
    expect(r.SELFIE_AT_CHECKIN.state).toBe('NOT_ASKED');
    expect(r.PRIVACY_NOTICE.at).toBeNull();
  });

  it('latest row per purpose wins regardless of input order', () => {
    const rows = [
      { purpose: 'SELFIE_AT_CHECKIN', granted: false, noticeVersion: NOTICE_VERSION, createdAt: at('2026-03-02') },
      { purpose: 'SELFIE_AT_CHECKIN', granted: true, noticeVersion: NOTICE_VERSION, createdAt: at('2026-03-01') },
      { purpose: 'LOCATION_AT_CHECKIN', granted: true, noticeVersion: NOTICE_VERSION, createdAt: at('2026-03-01') },
    ];
    const r = resolveConsents(rows);
    expect(r.SELFIE_AT_CHECKIN.state).toBe('WITHDRAWN');
    expect(r.LOCATION_AT_CHECKIN.state).toBe('GRANTED');
    expect(r.AI_ASSISTANT_LLM.state).toBe('NOT_ASKED');
  });

  it('a grant against an older notice version is OUTDATED; a withdrawal stays WITHDRAWN', () => {
    const rows = [
      { purpose: 'PRIVACY_NOTICE', granted: true, noticeVersion: 1, createdAt: at('2026-01-01') },
      { purpose: 'LOCATION_AT_CHECKIN', granted: false, noticeVersion: 1, createdAt: at('2026-01-01') },
    ];
    const r = resolveConsents(rows, 2);
    expect(r.PRIVACY_NOTICE.state).toBe('OUTDATED');
    expect(r.LOCATION_AT_CHECKIN.state).toBe('WITHDRAWN');
  });

  it('ignores unknown purposes', () => {
    const r = resolveConsents([{ purpose: 'MARKETING', granted: true, noticeVersion: 1, createdAt: at('2026-01-01') }]);
    expect(Object.keys(r)).not.toContain('MARKETING');
    expect(isConsentPurpose('MARKETING')).toBe(false);
    expect(isConsentPurpose('toString')).toBe(false);
    expect(isConsentPurpose('SELFIE_AT_CHECKIN')).toBe(true);
  });
});

describe('planErasure', () => {
  const now = at('2026-09-21T00:00:00Z');
  it.each(['ACTIVE', 'INACTIVE', 'SUSPENDED'])('refuses %s employees', (status) => {
    expect(planErasure({ status, lastWorkingDate: null, now, retentionYears: 8 }).allowed).toBe(false);
  });
  it('allows only PARTIAL erasure inside the retention window', () => {
    const p = planErasure({ status: 'LEFT', lastWorkingDate: at('2024-03-31'), now, retentionYears: 8 });
    expect(p).toMatchObject({ allowed: true, level: 'PARTIAL' });
    expect(p.retainUntil?.toISOString().slice(0, 10)).toBe('2032-03-31');
  });
  it('allows FULL anonymisation once retention has lapsed', () => {
    expect(planErasure({ status: 'LEFT', lastWorkingDate: at('2017-03-31'), now, retentionYears: 8 })).toMatchObject({ allowed: true, level: 'FULL' });
  });
  it('is PARTIAL when the last working date is unknown', () => {
    expect(planErasure({ status: 'LEFT', lastWorkingDate: null, now, retentionYears: 8 })).toMatchObject({ allowed: true, level: 'PARTIAL' });
  });
  it('boundary: exactly at the retention end date is FULL', () => {
    expect(planErasure({ status: 'LEFT', lastWorkingDate: at('2018-09-21T00:00:00Z'), now, retentionYears: 8 }).level).toBe('FULL');
  });
});

describe('request SLA and KYC documents', () => {
  it('due date is 90 days out by default (DPDP Rules r.14)', () => {
    expect(requestDueDate(at('2026-09-01T00:00:00Z')).toISOString().slice(0, 10)).toBe('2026-11-30');
  });
  it('Board breach report is due 72 hours after detection', () => {
    expect(breachBoardDeadline(at('2026-09-01T10:00:00Z')).toISOString()).toBe('2026-09-04T10:00:00.000Z');
  });
  it('keeps PAN/bank/PF proofs during partial erasure but not other documents', () => {
    for (const t of ['PAN Card', 'Bank passbook', 'UAN letter', 'PF nomination', 'ESI card']) expect(KYC_DOCUMENT_TYPE.test(t)).toBe(true);
    for (const t of ['Aadhaar', 'Resume', 'Photo', 'Offer letter']) expect(KYC_DOCUMENT_TYPE.test(t)).toBe(false);
  });
});
