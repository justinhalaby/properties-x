"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CompanyWithRelations } from "@/types/company-registry";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/companies');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch companies');
      }

      setCompanies(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold text-white mb-2">Companies & Owners</h1>
        <p className="text-gray-400">
          View all companies from the Quebec business registry with their shareholders and administrators
        </p>
      </div>

      {companies.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No companies found</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    NEQ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Shareholders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Administrators
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
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-white">{company.company_name}</div>
                        {company.domicile_city && (
                          <div className="text-sm text-gray-400">{company.domicile_city}, {company.domicile_province}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-gray-300">{company.neq}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        company.company_status === 'Immatriculée'
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {company.company_status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-gray-300">{company.shareholders?.length || 0}</div>
                        {company.shareholders && company.shareholders.length > 0 && (
                          <div className="text-gray-500 text-xs mt-1">
                            {company.shareholders.slice(0, 2).map((s, idx) => (
                              <div key={idx} className="truncate max-w-xs">
                                {s.shareholder_name}
                                {s.is_majority_shareholder && <span className="ml-1 text-yellow-500">★</span>}
                              </div>
                            ))}
                            {company.shareholders.length > 2 && (
                              <div className="text-gray-600">+{company.shareholders.length - 2} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-gray-300">{company.administrators?.length || 0}</div>
                        {company.administrators && company.administrators.length > 0 && (
                          <div className="text-gray-500 text-xs mt-1">
                            {company.administrators.slice(0, 2).map((a, idx) => (
                              <div key={idx} className="truncate max-w-xs">
                                {a.administrator_name} ({a.position_title})
                              </div>
                            ))}
                            {company.administrators.length > 2 && (
                              <div className="text-gray-600">+{company.administrators.length - 2} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">
                        {company.property_links?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/companies/${company.id}`}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        Showing {companies.length} {companies.length === 1 ? 'company' : 'companies'}
      </div>
    </div>
  );
}
