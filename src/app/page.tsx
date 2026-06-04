'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [assetCount, setAssetCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);
  const [recentAssets, setRecentAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [assetsRes, ticketsRes, recentRes] = await Promise.all([
          supabase.from('assets').select('*', { count: 'exact', head: true }),
          supabase.from('repair_tickets').select('*', { count: 'exact', head: true }).eq('status', 'เปิด'),
          supabase.from('assets').select('id, name, asset_code, status, created_at').order('created_at', { ascending: false }).limit(5)
        ]);

        setAssetCount(assetsRes.count || 0);
        setTicketCount(ticketsRes.count || 0);
        setRecentAssets(recentRes.data || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Overview of your IT Assets</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-gray-500 text-sm font-medium">Total Assets</span>
          <span className="text-3xl font-bold mt-2">{assetCount}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-gray-500 text-sm font-medium">Open Tickets</span>
          <span className="text-3xl font-bold mt-2 text-red-600">{ticketCount}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-gray-500 text-sm font-medium">Under Warranty</span>
          <span className="text-3xl font-bold mt-2 text-green-600">--</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-gray-500 text-sm font-medium">Checked Out</span>
          <span className="text-3xl font-bold mt-2 text-blue-600">--</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-8">
        <h2 className="text-xl font-bold mb-4">Recently Added Assets</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 font-semibold text-gray-600">Asset Code</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Name</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Added</th>
              </tr>
            </thead>
            <tbody>
              {recentAssets?.map((asset) => (
                <tr key={asset.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">{asset.asset_code}</td>
                  <td className="py-3 px-4 font-medium">{asset.name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      {asset.status || 'Active'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-sm">
                    {new Date(asset.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {recentAssets.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No assets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
