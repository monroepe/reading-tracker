import { Button } from '@/components/ui/button';

export function QueryError({ message, retry, retrying = false }: { message: string; retry: () => void, retrying?: boolean }) {
    return <div role="alert" className="space-y-2">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" disabled={retrying} onClick={retry}>Try again</Button>
    </div>;
}
