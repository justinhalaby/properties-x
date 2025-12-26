"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Owner {
  owner_name: string;
  owner_status: string | null;
  owner_postal_address: string | null;
  property_count: number;
  company_id: string | null;
  is_scraped: boolean;
}

export default function CompaniesPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrapingOwner, setScrapingOwner] = useState<string | null>(null);

  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/owners');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch owners');
      }

      setOwners(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (ownerName: string) => {
    try {
      setScrapingOwner(ownerName);
      setError(null);

      const response = await fetch('/api/companies/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: ownerName }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to scrape company');
      }

      // Refresh the owners list to update the scraped status
      await fetchOwners();

      alert(`Successfully scraped: ${result.message}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to scrape company';
      setError(errorMsg);
      alert(`Error: ${errorMsg}`);
    } finally {
      setScrapingOwner(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="text-gray-400">Loading companies...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-900 rounded-lg p-4">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Property Owners</h1>
          <p className="text-gray-400">
            All distinct property owners from Montreal evaluation data
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-900 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {owners.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No owners found</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Owner Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Postal Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Properties
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {owners.map((owner, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      {owner.is_scraped && owner.company_id ? (
                        <Link
                          href={`/companies/${owner.company_id}`}
                          className="font-medium text-blue-400 hover:text-blue-300"
                        >
                          {owner.owner_name}
                        </Link>
                      ) : (
                        <div className="font-medium text-white">{owner.owner_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">
                        {owner.owner_status || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300 max-w-xs truncate">
                        {owner.owner_postal_address || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400">
                          {owner.property_count} {owner.property_count === 1 ? 'property' : 'properties'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/owners/${encodeURIComponent(owner.owner_name)}`}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium transition-colors"
                        >
                          View on Map
                        </Link>
                        {owner.is_scraped ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-400">
                            Scraped
                          </span>
                        ) : (
                          <button
                            onClick={() => handleScrape(owner.owner_name)}
                            disabled={scrapingOwner === owner.owner_name}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg font-medium transition-colors"
                          >
                            {scrapingOwner === owner.owner_name ? 'Scraping...' : 'Scrape'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        Showing {owners.length} distinct {owners.length === 1 ? 'owner' : 'owners'}
      </div>
    </div>
  );
}
