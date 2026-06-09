'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PRPrintViewProps {
  document: any;
}

export default function PRPrintView({ document }: PRPrintViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!document || !mounted) return null;
  const metadata = document.metadata || {};

  // Ensure 8 rows
  const loadedItems = document.items || [];
  const items = [...loadedItems];
  while (items.length < 8) {
    items.push({ name: '', quantity: '', price: '' });
  }
  const displayItems = items.slice(0, 8);

  const totalAmount = displayItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return sum + (qty * price);
  }, 0);

  const PrintValue = ({ value, className = "" }: any) => (
    <div className={`border-b border-black text-center min-h-[20px] pb-0.5 ${className}`}>
      {value || '\u00A0'}
    </div>
  );

  return createPortal(
    <div id="pr-print-wrapper" className="hidden print:flex absolute top-0 left-0 w-full bg-white justify-center items-start z-[9999]">
      <style dangerouslySetInnerHTML={{
        __html: `
        @page {
          size: A4 portrait;
          margin: 0mm;
        }
        @media print {
          html, body { 
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            background-color: white !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
          body > *:not(#pr-print-wrapper) {
            display: none !important;
          }
          #pr-print-wrapper {
            display: flex !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            background: white !important;
            justify-content: center;
            align-items: flex-start;
            overflow: hidden !important;
          }
          .print-paper {
            width: 794px !important;
            height: 1123px !important;
            padding: 15px 30px !important;
            box-sizing: border-box;
            box-shadow: none !important;
            margin: 0 !important;
            transform: scale(0.96);
            transform-origin: top center;
          }
        }
      `}} />

      <div className="print-paper bg-white text-black relative" style={{ fontFamily: 'Arial, sans-serif' }}>

        {/* Double Border that stops before the bottom text */}
        <div className="absolute top-2 left-2 right-2 bottom-[30px] border-2 border-black pointer-events-none"></div>
        <div className="absolute top-[12px] left-[12px] right-[12px] bottom-[36px] border border-black pointer-events-none"></div>

        <div className="relative z-10 px-4 py-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 mt-1">
            <div className="w-40">
              <img src="/rpm-logo.jpg" alt="RPM Logo" className="h-16 object-contain" />
            </div>
            <div className="text-center flex-1">
              <h1 className="text-xl font-bold underline" style={{ letterSpacing: '0.5px' }}>PURCHASE REQUISITION FORM</h1>
            </div>
            <div className="w-40"></div>
          </div>

          {/* Header Fields */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-1 text-[12px] mb-2">
            <div className="flex items-end">
              <span className="w-24 shrink-0">Department</span>
              <PrintValue value={metadata.department} className="flex-1" />
            </div>
            <div className="flex items-end">
              <span className="w-32 shrink-0">Purchasing Mgr</span>
              <PrintValue value={metadata.purchasing_mgr} className="flex-1" />
            </div>
            <div className="flex items-end">
              <span className="w-24 shrink-0">Date</span>
              <PrintValue value={metadata.date || new Date().toLocaleDateString('en-GB')} className="flex-1" />
            </div>
            <div className="flex items-end">
              <span className="w-32 shrink-0">Telephone</span>
              <PrintValue value={metadata.telephone} className="flex-1" />
            </div>
            <div className="col-start-2 flex items-end">
              <span className="w-32 shrink-0">Email</span>
              <PrintValue value={metadata.email} className="flex-1" />
            </div>
          </div>

          {/* 1. Reason for Purchase */}
          <div className="mb-1 text-[12px]">
            <div className="flex">
              <span className="w-6 shrink-0">1</span>
              <span className="shrink-0 mr-4">Reason for Purchase</span>
              <PrintValue value={metadata.reason_for_purchase} className="flex-1" />
            </div>
            <div className="flex items-end mt-1">
              <div className="w-6 shrink-0"></div>
              <PrintValue value={metadata.reason_for_purchase_2} className="w-[60%]" />
              <span className="mx-4 shrink-0">Date Required:</span>
              <PrintValue value={metadata.date_required} className="flex-1" />
            </div>
          </div>

          {/* 2. Items Table */}
          <div className="mb-1 text-[12px]">
            <div className="flex mb-1">
              <span className="w-6 shrink-0">2</span>
              <span>Description of Items and Quantity to be Purchased</span>
            </div>
            <div className="ml-6 border-2 border-black">
              <div className="flex bg-[#deeaf6] border-b-2 border-black font-semibold text-center text-[12px]">
                <div className="w-[10%] py-1 border-r border-black">QTY</div>
                <div className="w-[70%] py-1 border-r border-black">ITEM</div>
                <div className="w-[20%] py-1">UNIT PRICE</div>
              </div>
              {displayItems.map((item, idx) => (
                <div key={idx} className={`flex ${idx !== displayItems.length - 1 ? 'border-b border-black' : ''}`}>
                  <div className="w-[10%] border-r border-black p-0.5 text-center min-h-[24px]">{item.quantity}</div>
                  <div className="w-[70%] border-r border-black p-0.5 px-1 min-h-[24px]">{item.name}</div>
                  <div className="w-[20%] p-0.5 px-1 text-right min-h-[24px]">{item.price ? Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Total Cost */}
          <div className="mb-1 text-[12px]">
            <div className="flex">
              <span className="w-6 shrink-0">3</span>
              <span className="shrink-0 mr-4">Total Cost (please attach all quotations and other relevant documentation)</span>
            </div>
            <div className="flex items-end mt-1">
              <div className="w-6 shrink-0"></div>
              <span className="mr-2">THB:</span>
              <div className="w-[45%] border-b border-black text-center font-bold pb-0.5">{totalAmount > 0 ? totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '\u00A0'}</div>
              <span className="mx-4 shrink-0">Foreign Currency</span>
              <PrintValue value={metadata.total_foreign} className="flex-1" />
            </div>
          </div>

          {/* 4. Budget Control */}
          <div className="mb-1 text-[12px]">
            <div className="flex mb-2">
              <span className="w-6 shrink-0">4</span>
              <span>Budget Control (please tick one box)</span>
            </div>
            <div className="flex items-end mt-1">
              <div className="w-6 shrink-0"></div>
              <div className="flex items-center gap-6 w-[45%]">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black flex items-center justify-center bg-white">
                    {metadata.budget_control === 'Budgeted' && <div className="w-2 h-2 bg-black"></div>}
                  </div>
                  Budgeted
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black flex items-center justify-center bg-white">
                    {metadata.budget_control === 'Not Budgeted' && <div className="w-2 h-2 bg-black"></div>}
                  </div>
                  Not Budgeted
                </div>
              </div>
              <span className="mx-4 shrink-0">Budget code & Title</span>
              <PrintValue value={metadata.budget_code} className="flex-1" />
            </div>
          </div>

          {/* 5. 3 Quotations */}
          <div className="mb-1 text-[12px]">
            <div className="flex">
              <span className="w-6 shrink-0">5</span>
              <span className="shrink-0 mr-4">Prepare and attach a detailed summary of the 3 quotations obtained <span className="text-[10px] text-gray-600">(include contact details of suppliers/contractors)</span></span>
            </div>
            <div className="flex items-end mt-1">
              <div className="w-6 shrink-0"></div>
              <span className="shrink-0 mr-4">If 3 quotes were not obtained, please state the reasons:</span>
              <PrintValue value={metadata.no_quotes_reason} className="flex-1 min-w-0" />
            </div>
          </div>

          {/* 6. Preferred Supplier */}
          <div className="mb-1 text-[12px]">
            <div className="flex mb-2">
              <span className="w-6 shrink-0">6</span>
              <span>Department's preferred supplier/contractor</span>
            </div>
            <div className="flex items-end mt-1">
              <div className="w-6 shrink-0"></div>
              <span className="shrink-0 w-56">Name of Supplier/contractor</span>
              <PrintValue value={metadata.preferred_supplier} className="flex-1 min-w-0" />
            </div>
            <div className="flex items-end mt-2">
              <div className="w-6 shrink-0"></div>
              <span className="shrink-0 w-56">Quote submitted</span>
              <span className="shrink-0 mr-2">THB</span>
              <PrintValue value={metadata.preferred_quote_thb} className="w-24 mr-4" />
              <span className="shrink-0 mr-2">Foreign Currency <span className="text-[10px]">(if applicable)</span></span>
              <PrintValue value={metadata.preferred_quote_foreign} className="flex-1 min-w-0" />
            </div>
            <div className="flex items-end mt-2">
              <div className="w-6 shrink-0"></div>
              <span className="shrink-0 mr-2">If the Department's supplier/contractor is not the lowest quote received, please state the reason(s):</span>
            </div>
            <div className="flex items-end mt-1">
              <div className="w-6 shrink-0"></div>
              <PrintValue value={metadata.not_lowest_reason} className="flex-1 min-w-0" />
            </div>
          </div>

          {/* 7. Recommended Supplier */}
          <div className="mb-2 text-[12px]">
            <div className="flex mb-1">
              <span className="w-6 shrink-0">7</span>
              <span>Purchasing Recommended supplier/contractor</span>
            </div>
            <div className="flex items-end mt-1">
              <div className="w-6 shrink-0"></div>
              <span className="shrink-0 w-56">Name of Supplier/contractor</span>
              <PrintValue value={metadata.recommended_supplier} className="w-[45%] mr-4 min-w-0" />
              <span className="shrink-0 mr-2">Remark</span>
              <PrintValue value={metadata.recommended_remark} className="flex-1 min-w-0" />
            </div>
            <div className="flex items-end mt-2">
              <div className="w-6 shrink-0"></div>
              <span className="shrink-0 w-48">Final Price submitted</span>
              <span className="shrink-0 w-16 text-center">THB</span>
              <PrintValue value={metadata.recommended_price_thb} className="w-40 mr-4" />
              <span className="shrink-0 mr-2">Foreign Currency <span className="text-[10px]">(if applicable)</span></span>
              <PrintValue value={metadata.recommended_price_foreign} className="flex-1 min-w-0" />
            </div>
          </div>

          {/* 10. Approvals */}
          <div className="mb-1 text-[12px]">
            <div className="flex mb-1">
              <span className="w-6 shrink-0">10</span>
              <div className="flex w-full">
                <span className="w-[50%]">Approvals</span>
                <span className="w-[50%]">Purchasing</span>
              </div>
            </div>

            <div className="ml-6 grid grid-cols-2 gap-x-12">
              {/* Row 1 */}
              <div className="flex flex-col mb-1">
                <div className="h-5 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                <div className="flex items-end">
                  <span className="mr-2">Name:</span>
                  <PrintValue value={metadata.appr_head_name} className="w-[45%] mr-2" />
                  <span className="mr-2">Date</span>
                  <PrintValue value={metadata.appr_head_date} className="flex-1 min-w-0" />
                </div>
                <div className="mt-1">Head of Department</div>
              </div>

              <div className="flex flex-col mb-1">
                <div className="h-5 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                <div className="flex items-end">
                  <span className="mr-2">Name:</span>
                  <PrintValue value={metadata.appr_pur_name} className="w-[45%] mr-2" />
                  <span className="mr-2">Date</span>
                  <PrintValue value={metadata.appr_pur_date} className="flex-1 min-w-0" />
                </div>
                <div className="mt-1">Purchasing</div>
              </div>

              {/* Row 2 */}
              <div className="flex flex-col mb-1 mt-1">
                <div className="h-5 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                <div className="flex items-end">
                  <span className="mr-2">Name:</span>
                  <PrintValue value={metadata.appr_fin_name} className="w-[45%] mr-2" />
                  <span className="mr-2">Date</span>
                  <PrintValue value={metadata.appr_fin_date} className="flex-1 min-w-0" />
                </div>
                <div className="mt-1">Finance Director</div>
              </div>
              <div></div> {/* Empty for Row 2 Right */}

              {/* Row 3 */}
              <div className="flex flex-col mb-1 mt-1">
                <div className="h-5 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                <div className="flex items-end">
                  <span className="mr-2">Name:</span>
                  <PrintValue value={metadata.appr_md_name} className="w-[45%] mr-2" />
                  <span className="mr-2">Date</span>
                  <PrintValue value={metadata.appr_md_date} className="flex-1 min-w-0" />
                </div>
                <div className="mt-1">Managing Director</div>
              </div>

              <div className="flex flex-col mb-1 mt-1">
                <div className="h-5 mb-1 flex items-end w-[70%]"><div className="border-b border-black w-full"></div></div>
                <div className="flex items-end">
                  <span className="mr-2">Name:</span>
                  <PrintValue value={metadata.appr_chair_name} className="w-[45%] mr-2" />
                  <span className="mr-2">Date</span>
                  <PrintValue value={metadata.appr_chair_date} className="flex-1 min-w-0" />
                </div>
                <div className="mt-1">Chairman (if applicable)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Text outside the border */}
        <div className="absolute bottom-[4px] left-[14px] text-[10px]">
          Please refer to the Authority Matrix to determine the correct approvals required.
        </div>
      </div>
    </div>,
    window.document.body
  );
}
