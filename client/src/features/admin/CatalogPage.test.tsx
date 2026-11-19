import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ReadDataContext, httpReadData } from '@/data/readData';
import { WriteDataContext, httpWriteData } from '@/data/writeData';
import { ReadOnlyContext } from '@/data/capabilities';
import { CatalogPage } from './CatalogPage';
afterEach(cleanup);
function setup(locked=false) {
  const createCatalog=vi.fn(async()=>({id:2,name:'France'}));
  const renameCatalog=vi.fn(async()=>undefined);
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ReadOnlyContext value={locked}><ReadDataContext value={{...httpReadData,countries:{list:async()=>[{id:1,name:'Canada'}]}}}><WriteDataContext value={{...httpWriteData,createCatalog,renameCatalog}}><CatalogPage kind="countries"/></WriteDataContext></ReadDataContext></ReadOnlyContext></QueryClientProvider></MemoryRouter>);
  return {createCatalog,renameCatalog};
}
it('adds trimmed catalog names and renames the selected identity',async()=>{
  const {createCatalog,renameCatalog}=setup();
  await screen.findByText('Canada');
  fireEvent.change(screen.getByLabelText('New country name'),{target:{value:' France '}});
  fireEvent.click(screen.getByRole('button',{name:'Add'}));
  await waitFor(()=>expect(createCatalog).toHaveBeenCalledWith('countries','France'));
  await waitFor(()=>expect((screen.getByLabelText('New country name') as HTMLInputElement).value).toBe(''));
  fireEvent.click(screen.getByRole('button',{name:'Rename'}));
  fireEvent.change(screen.getByLabelText('Rename to'),{target:{value:'Canada renamed'}});
  fireEvent.click(screen.getByRole('button',{name:'Save'}));
  await waitFor(()=>expect(renameCatalog).toHaveBeenCalledWith('countries',1,'Canada renamed'));
});
it('allows browsing while pending export prevents catalog writes',async()=>{
  const {createCatalog,renameCatalog}=setup(true);
  await screen.findByText('Canada');
  expect((screen.getByRole('button',{name:'Add'}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button',{name:'Rename'}) as HTMLButtonElement).disabled).toBe(true);
  expect(createCatalog).not.toHaveBeenCalled();expect(renameCatalog).not.toHaveBeenCalled();
});
