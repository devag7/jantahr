import * as React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { closeForm } from '@/lib/nav';
import { Ionicons } from '@expo/vector-icons';
import { pickReceipt } from '@/features/device';
import { useCreateClaim, useExpenseCategories } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { uploadFile, type LocalFile } from '@/lib/files';
import { formatDate, formatINR, isoDate } from '@/lib/format';
import { CalendarPicker } from '@/ui/calendar';
import { Button, Card, Field, IconButton, Page, Section, Segmented, Text } from '@/ui/kit';
import { Sheet, useToast } from '@/ui/overlays';
import { radius, space, useTheme } from '@/ui/theme';

interface Item { key: number; expenseDate: string; category: string; amount: string; description: string; receipt: LocalFile | null }
const blank = (key: number, category = ''): Item => ({ key, expenseDate: isoDate(new Date()), category, amount: '', description: '', receipt: null });

/** A claim is a title and one or more spends, each with an optional receipt photo. Save it, or send it straight away. */
export default function NewClaim() {
  const { colors } = useTheme();
  const toast = useToast();
  const categories = useExpenseCategories().data ?? [];
  const create = useCreateClaim();
  const [title, setTitle] = React.useState('');
  const [items, setItems] = React.useState<Item[]>([blank(1)]);
  const [datePicking, setDatePicking] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);
  React.useEffect(() => { if (categories[0]) setItems((list) => list.map((i) => (i.category ? i : { ...i, category: categories[0] }))); }, [categories.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: number, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const valid = title.trim().length >= 3 && items.every((i) => Number(i.amount) > 0 && i.category);

  const save = async (submit: boolean) => {
    setUploading(true);
    try {
      // receipts go up first; each item carries the stored file's address
      const withReceipts = await Promise.all(items.map(async (i) => ({
        expenseDate: i.expenseDate, category: i.category, amount: Number(i.amount), description: i.description.trim() || undefined,
        receiptUrl: i.receipt ? (await uploadFile<{ receiptUrl: string }>('/expenses/receipts', i.receipt)).receiptUrl : undefined,
      })));
      setUploading(false);
      create.mutate({ title: title.trim(), items: withReceipts, submit }, { onSuccess: () => closeForm('/expenses') });
    } catch (e) {
      setUploading(false);
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <Page>
      <Field label="What is this claim for?" value={title} onChangeText={setTitle} placeholder="Client visit, Mumbai, October" maxLength={120} />
      {items.map((item, n) => (
        <Section key={item.key} title={`Spend ${n + 1}`} action={items.length > 1 ? <IconButton icon="trash-outline" label={`Remove spend ${n + 1}`} tone={colors.danger} onPress={() => setItems(items.filter((i) => i.key !== item.key))} /> : undefined}>
          <Card style={{ gap: space.lg }}>
            <Segmented value={item.category} onChange={(c) => set(item.key, { category: c })} options={categories.map((c) => ({ value: c, label: c }))} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}><Field label="Amount (₹)" value={item.amount} onChangeText={(t) => set(item.key, { amount: t.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" placeholder="0" /></View>
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="caption" tone="secondary" bold>Date</Text>
                <Pressable onPress={() => setDatePicking(item.key)} accessibilityRole="button" accessibilityLabel={`Date, ${formatDate(item.expenseDate)}`}
                  style={[styles.dateBox, { borderColor: colors.border, backgroundColor: colors.card }]}><Text>{formatDate(item.expenseDate)}</Text></Pressable>
              </View>
            </View>
            <Field label="Note (optional)" value={item.description} onChangeText={(t) => set(item.key, { description: t })} placeholder="Cab from airport" maxLength={200} />
            {item.receipt ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Image source={{ uri: item.receipt.uri }} style={styles.thumb} accessibilityLabel="Receipt photo" />
                <Text style={{ flex: 1 }}>Receipt added</Text>
                <IconButton icon="close-circle" label="Remove receipt" tone={colors.textTertiary} onPress={() => set(item.key, { receipt: null })} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Button title="Photo of receipt" kind="secondary" icon="camera-outline" compact style={{ flex: 1 }} onPress={async () => { const r = await pickReceipt('camera').catch(() => null); if (r) set(item.key, { receipt: r }); }} />
                <Button title="From gallery" kind="secondary" icon="images-outline" compact style={{ flex: 1 }} onPress={async () => { const r = await pickReceipt('library').catch(() => null); if (r) set(item.key, { receipt: r }); }} />
              </View>
            )}
          </Card>
        </Section>
      ))}
      <Button title="Add another spend" kind="ghost" icon="add" onPress={() => setItems([...items, blank(Date.now(), categories[0])])} />
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1 }}>Total</Text><Text variant="heading" num>{formatINR(total)}</Text></Card>
      <View style={{ gap: space.sm }}>
        <Button title="Submit for approval" disabled={!valid} loading={uploading || (create.isPending && create.variables?.submit === true)} onPress={() => void save(true)} />
        <Button title="Save as draft" kind="secondary" disabled={!valid || uploading} loading={create.isPending && create.variables?.submit === false} onPress={() => void save(false)} />
      </View>
      <Sheet open={datePicking !== null} onClose={() => setDatePicking(null)} title="Date of the spend">
        <CalendarPicker range={false} from={items.find((i) => i.key === datePicking)?.expenseDate ?? null} to={null} maxDate={isoDate(new Date())}
          onChange={(d) => { if (datePicking !== null && d) set(datePicking, { expenseDate: d }); setDatePicking(null); }} />
      </Sheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  dateBox: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center' },
  thumb: { width: 48, height: 48, borderRadius: 8 },
});
