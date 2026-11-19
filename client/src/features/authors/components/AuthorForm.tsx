import { useReadData } from '@/data/readData';
import { useWriteData } from '@/data/writeData';
import { useCompanion } from '@/data/capabilities';
import { useMe } from '@/features/auth/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FormCancelLink } from '@/components/FormCancelLink';
import { useFormDraftState, clearFormDraft } from '@/hooks/useFormDraftState';
import { type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';

import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxValue, useComboboxAnchor } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';



const GENDERS = ['Female', 'Male', 'Non-binary'] as const;

// "Jane Austen" -> first/last. One word is treated as a last name (last name is required).
function splitName(full: string) {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { firstName: '', lastName: words[0] ?? '' };
  }
  return { firstName: words[0], lastName: words.slice(1).join(' ') };
}

export type AuthorPayload = {
  firstName: string;
  middleName: string;
  lastName: string;
  countryIds?: number[];
  gender: string | null;
};

export type AuthorFormInitial = {
  firstName: string;
  middleName: string;
  lastName: string;
  countryIds?: number[];
  gender: string | null;
};

type Props = {
  heading: string;
  submitLabel: string;
  cancelTo: string;
  initial?: AuthorFormInitial;
  isPending: boolean;
  error: Error | null;
  onSubmit: (payload: AuthorPayload) => void;
};

export function AuthorForm({
  heading,
  submitLabel,
  cancelTo,
  initial,
  isPending,
  error,
  onSubmit,
}: Props) {
  const location = useLocation();
  const reads = useReadData(), writes = useWriteData(), cache = useQueryClient();
  const companion = useCompanion();
  const me = useMe(!companion);
  const canCreate = companion || me.data?.role === 'admin';
  const catalog = useQuery({queryKey:['countries'],queryFn:()=>reads.countries!.list()});
  const [params] = useSearchParams();
  const prefill = initial ? null : splitName(params.get('name') ?? '');

  const [firstName, setFirstName] = useFormDraftState('firstName', initial?.firstName ?? prefill?.firstName ?? '');
  const [middleName, setMiddleName] = useFormDraftState('middleName', initial?.middleName ?? '');
  const [lastName, setLastName] = useFormDraftState('lastName', initial?.lastName ?? prefill?.lastName ?? '');
  const [countryIds, setCountryIds] = useFormDraftState<number[]>('countryIds', initial?.countryIds ?? []);
  const [country, setCountry] = useFormDraftState('countrySearch', '');
  const [gender, setGender] = useFormDraftState('gender', initial?.gender ?? '');

  const anchor = useComboboxAnchor();
  const countries = catalog.data ?? [];
  const createCountry = useMutation({mutationFn:()=>writes.createCatalog!('countries',country.trim()),onSuccess:async c=>{
    setCountryIds(ids=>[...new Set([...ids,c.id])]);setCountry('');await cache.invalidateQueries({queryKey:['countries']});
  }});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      lastName: lastName.trim(),
      countryIds,
      gender: gender || null,
    });
  }

  return (
    <section className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">{heading}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Label className="flex-col items-start">
          First name
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Label>

        <Label className="flex-col items-start">
          Middle name / initials (optional)
          <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
        </Label>

        <Label className="flex-col items-start">
          Last name
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </Label>

        <p className="text-sm text-muted-foreground">
          For a single name like Voltaire, leave first name empty.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="country">Countries</Label>
          <Combobox multiple items={countries} value={countries.filter(c => countryIds.includes(c.id))}
            onValueChange={selected => setCountryIds(selected.map(c => c.id))}
            inputValue={country} onInputValueChange={setCountry}
            itemToStringLabel={c => c.name} isItemEqualToValue={(a, b) => a.id === b.id}
            disabled={catalog.isPending || catalog.isError || createCountry.isPending}>
            <ComboboxChips ref={anchor}>
              <ComboboxValue>
                {(selected: { id: number; name: string }[]) => <>
                  {selected.map(c => <ComboboxChip key={c.id}>{c.name}</ComboboxChip>)}
                  <ComboboxChipsInput id="country" placeholder={selected.length ? '' : 'Select countries…'} />
                </>}
              </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
              <ComboboxEmpty>No matching countries.</ComboboxEmpty>
              <ComboboxList>{c => <ComboboxItem key={c.id} value={c}>{c.name}</ComboboxItem>}</ComboboxList>
            </ComboboxContent>
          </Combobox>
          {catalog.isError && <p role="alert">Could not load countries.</p>}
          {canCreate && country.trim() && !countries.some(c=>c.name.toLowerCase()===country.trim().toLowerCase()) && <Button type="button" variant="outline" disabled={createCountry.isPending || catalog.isPending || catalog.isError} onClick={()=>createCountry.mutate()}>Create country “{country.trim()}”</Button>}
          {createCountry.isError && <p role="alert">{createCountry.error.message}</p>}

        </div>

        <Label className="flex-col items-start">
          Gender
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Label>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error.message === 'Already exists'
              ? 'An author with that name already exists.'
              : error.message}
          </p>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isPending || createCountry.isPending || catalog.isPending || catalog.isError || !lastName.trim()}>
            {isPending ? 'Saving…' : submitLabel}
          </Button>
          <Button
            render={<FormCancelLink to={cancelTo} onClick={() => clearFormDraft(location.pathname)} />}
            nativeButton={false}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}