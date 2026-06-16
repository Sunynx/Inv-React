import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEPARTMENT_ABBR: Record<string, string> = {
  'Project': 'PRO',
  'Admin': 'ADM',
  'Marketing': 'MKT',
  'Legal': 'LEG',
  'Marina': 'MRN'
};

export const CATEGORY_ABBR: Record<string, string> = {
  'Notebook': 'NB',
  'TV': 'TV',
  'Imac': 'MAC',
  'PC': 'PC',
  'Printer': 'PRN'
};

export function getAbbr(name: string, map: Record<string, string>): string {
  if (!name) return 'UNK';
  if (map[name]) return map[name];
  return name.substring(0, 3).toUpperCase();
}

export function generateAssetCodeStr(deptName: string, catName: string, seqNum: number, dateStr?: string): string {
  const dept = getAbbr(deptName, DEPARTMENT_ABBR);
  const cat = getAbbr(catName, CATEGORY_ABBR);
  
  let yy, mm, dd;
  if (dateStr) {
    const d = new Date(dateStr);
    yy = String(d.getFullYear() + 543).slice(-2);
    mm = String(d.getMonth() + 1).padStart(2, '0');
    dd = String(d.getDate()).padStart(2, '0');
  } else {
    const now = new Date();
    yy = String(now.getFullYear() + 543).slice(-2);
    mm = String(now.getMonth() + 1).padStart(2, '0');
    dd = String(now.getDate()).padStart(2, '0');
  }
  
  return `${dept}-${cat}-${yy}${mm}${dd}-${seqNum}`;
}
