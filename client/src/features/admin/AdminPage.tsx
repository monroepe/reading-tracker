import { useCompanion } from '@/data/capabilities';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function AdminPage() {
  const companion = useCompanion();
  return (
    <section className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="flex flex-wrap gap-3">
      <Button render={<Link to="/admin/countries" />} nativeButton={false}>Countries</Button>
      <Button render={<Link to="/admin/genres" />} nativeButton={false}>Genres</Button>
      {!companion && <Button render={<Link to="/admin/tags" />} nativeButton={false}>Edit Tags</Button>}
      </div>
    </section>
  );
}
