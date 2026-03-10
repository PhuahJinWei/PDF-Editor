'use client';

import { PageList } from '@/components/sidebar/PageList';
import { MergeSplitPanel } from '@/components/sidebar/MergeSplitPanel';

export function Sidebar() {
  return (
    <aside className="flex w-[180px] flex-col border-r border-border bg-surface">
      <div className="flex-1 overflow-y-auto p-2">
        <PageList />
      </div>
      <MergeSplitPanel />
    </aside>
  );
}
