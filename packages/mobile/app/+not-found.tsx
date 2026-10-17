import { Link, Stack } from 'expo-router';
import { Page, EmptyState, Text } from '@/ui/kit';

export default function NotFound() {
  return (
    <Page>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState icon="help-circle-outline" title="This screen does not exist" action={<Link href="/" replace><Text tone="accent">Go home</Text></Link>} />
    </Page>
  );
}
