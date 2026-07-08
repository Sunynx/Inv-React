'use client';

import { useState, useEffect } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  RowSelectionState,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export function exportDataToCSV(data: any[], columns: any[], filename = 'export.csv') {
  if (!data || data.length === 0) return;
  const validCols = columns.filter(c => c.accessorKey && typeof c.header === 'string');
  const headers = validCols.map(c => c.header);
  const accessors = validCols.map(c => c.accessorKey);
  
  const rows = data.map(row => {
    return accessors.map(key => {
      const val = key.split('.').reduce((o: any, i: any) => (o ? o[i] : ''), row);
      const cellValue = val !== null && val !== undefined ? String(val) : '';
      return `"${cellValue.replace(/"/g, '""')}"`;
    }).join(',');
  });
  
  const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;
  emptyState?: React.ReactNode;
  enableRowSelection?: boolean;
  onRowSelectionChange?: (selectedRows: TData[]) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  onRowClick,
  emptyState,
  enableRowSelection = false,
  onRowSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection,
    state: {
      sorting,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize: 15 },
    }
  });

  useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getSelectedRowModel().rows.map(row => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection, table, onRowSelectionChange]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card text-card-foreground overflow-x-auto shadow-sm transition-colors duration-300">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="h-10 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {header.isPlaceholder ? null : (
                        <div
                          className={header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-1 hover:text-primary transition-colors' : ''}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-primary" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown className="h-3 w-3 text-primary" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-50" />
                            )
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  <div className="flex justify-center items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading data...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`border-border/50 hover:bg-muted/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id} 
                      className="p-2 align-middle"
                      onClick={(e) => {
                        if (cell.column.id === 'select' || cell.column.id === 'actions') {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 text-center p-0 align-middle">
                  {emptyState ? emptyState : <div className="py-12 text-muted-foreground">No results found.</div>}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground bg-card p-3 rounded-md border shadow-sm transition-colors duration-300">
        <div className="flex items-center flex-wrap gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span>แสดงหน้าละ</span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger className="h-8 w-[70px] bg-background">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 15, 20, 30, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>รายการ</span>
          </div>
          <div>
            แสดงผล {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} ถึง{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getPreFilteredRowModel().rows.length)} จากทั้งหมด{' '}
            {table.getPreFilteredRowModel().rows.length} รายการ
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportDataToCSV(data, columns, `export_${new Date().toISOString().split('T')[0]}.csv`)}
            className="h-8 hidden sm:flex text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10 dark:border-emerald-500/20 transition-colors"
          >
            <Download className="mr-2 h-3 w-3" /> Export CSV
          </Button>

          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (table.getCanPreviousPage()) table.previousPage(); }} 
                  className={`h-8 px-2 ${!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                />
              </PaginationItem>
              
              {Array.from({ length: table.getPageCount() }).map((_, i) => {
                const currentPage = table.getState().pagination.pageIndex;
                const pageCount = table.getPageCount();
                
                if (pageCount <= 5 || i === 0 || i === pageCount - 1 || (i >= currentPage - 1 && i <= currentPage + 1)) {
                  return (
                    <PaginationItem key={i} className="hidden sm:inline-block">
                      <PaginationLink 
                        href="#"
                        isActive={currentPage === i}
                        onClick={(e) => { e.preventDefault(); table.setPageIndex(i); }}
                        className="cursor-pointer h-8 w-8"
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (i === currentPage - 2 || i === currentPage + 2) {
                  return (
                    <PaginationItem key={i} className="hidden sm:inline-block">
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              })}

              <PaginationItem>
                <PaginationNext 
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (table.getCanNextPage()) table.nextPage(); }} 
                  className={`h-8 px-2 ${!table.getCanNextPage() ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
