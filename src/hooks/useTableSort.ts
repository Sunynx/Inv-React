import { useState, useMemo } from 'react';

type SortDirection = 'asc' | 'desc' | null;

export function useTableSort<T>(data: T[]) {
  const [sortConfig, setSortConfig] = useState<{ key: string | null, direction: SortDirection }>({ key: null, direction: null });

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else if (sortConfig.direction === 'desc') direction = null;
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;
    
    return [...data].sort((a: any, b: any) => {
      // Handle nested keys like "assets.name"
      const getVal = (obj: any, path: string) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
      };

      const aVal = getVal(a, sortConfig.key!);
      const bVal = getVal(b, sortConfig.key!);

      if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  return { sortedData, requestSort, sortConfig };
}
