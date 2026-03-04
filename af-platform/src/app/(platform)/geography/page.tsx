/**
 * /geography — Admin Geography Management
 *
 * Tabs: States | Cities | Haulage Areas | Ports
 * AFU only — sidebar already restricts visibility.
 */

'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { StatesTab, CitiesTab, HaulageAreasTab, PortsTab, CountriesTab } from './_components';

const TABS = ['States', 'Cities', 'Haulage Areas', 'Ports', 'Countries'] as const;
type Tab = (typeof TABS)[number];

export default function GeographyPage() {
  const [tab, setTab] = useState<Tab>('States');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-semibold text-[var(--text)]">Geography</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Manage states, cities, haulage areas, and ports
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-[var(--sky)] text-[var(--sky)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'States' && <StatesTab />}
      {tab === 'Cities' && <CitiesTab />}
      {tab === 'Haulage Areas' && <HaulageAreasTab />}
      {tab === 'Ports' && <PortsTab />}
      {tab === 'Countries' && <CountriesTab />}
    </div>
  );
}
