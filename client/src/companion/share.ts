import { exportFilename } from '@/lib/exportFilename';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function shareOutbound(serialized: string): Promise<void> {
    const { createdAt, transferId } = JSON.parse(serialized) as { createdAt?: string; transferId: string };
    const key = `export-created-at:${transferId}`;
    const timestamp = createdAt ?? localStorage.getItem(key) ?? new Date().toISOString();
    if (!createdAt) localStorage.setItem(key, timestamp);
    const { uri } = await Filesystem.writeFile({ path: exportFilename('phone-changes', timestamp), data: serialized, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Reading Tracker phone changes', files: [uri], dialogTitle: 'Send changes to your laptop' });
}
