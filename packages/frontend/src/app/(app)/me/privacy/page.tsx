'use client';
import { Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DownloadButton } from '@/components/common/download-button';
import { PageHeader } from '@/components/common/page-header';
import { ConsentPanel, PrivacyNoticeCard } from '@/components/privacy/consent-panel';
import { MyRequests } from '@/components/privacy/my-requests';
import { privacyService } from '@/services/privacy/privacy.service';

export default function MyPrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy & my data" description="See how your personal data is used, control optional uses, download your data and exercise your rights under the DPDP Act." />
      <div className="space-y-6">
        <PrivacyNoticeCard />
        <ConsentPanel />
        <Card>
          <CardHeader><CardTitle>Download my data</CardTitle><CardDescription>A machine-readable copy (JSON) of your profile, leave, attendance, payslips, declarations, claims and the consents you gave. It includes your own PAN, Aadhaar and bank details in full, so store it safely.</CardDescription></CardHeader>
          <CardContent><DownloadButton variant="outline" icon={false} onDownload={privacyService.downloadMyData}><Download className="mr-2 h-4 w-4" />Download my data</DownloadButton></CardContent>
        </Card>
        <MyRequests />
      </div>
    </>
  );
}
