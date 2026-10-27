import { permanentRedirect } from 'next/navigation';

export default function LegacyLoyaltyDownloadPage() {
  permanentRedirect('/qr-code/');
}
