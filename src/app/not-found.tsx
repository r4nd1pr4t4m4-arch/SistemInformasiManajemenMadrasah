import { PublicShell } from '@/components/layout/public-shell';
import { NotFoundState } from '@/components/ui/state-views';

export default function NotFound() {
  return (
    <PublicShell>
      <NotFoundState />
    </PublicShell>
  );
}
