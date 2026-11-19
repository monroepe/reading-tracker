import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useLogin, useMe } from './useAuth';

export function LoginPage() {
  const me = useMe();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (me.isSuccess && me.data) return <Navigate to="/" replace />;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <>
      <AppHeader brandOnly />
      <main className="px-4 py-8 sm:py-12">
        <Card className="mx-auto w-full max-w-sm">
          <CardHeader><h1 className="text-xl font-semibold">Log in</h1></CardHeader>
          <CardContent>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {login.isError && <p role="alert" className="text-sm text-destructive">{login.error.message}</p>}
        <Button className="w-full" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
