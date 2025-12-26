"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import type { CompanyWithRelations } from "@/types/company-registry";

interface MatchedProperty {
  matricule: string;
  address: string;
  owner_name: string;
  evaluated_value: number | null;
  matchType: 'exact' | 'fuzzy';
  [key: string]: any;
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [company, setCompany] = useState<CompanyWithRelations | null>(null);
  const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanyDetails();
  }, [id]);

  const fetchCompanyDetails = async () => {
    try {
      setLoading(true);
      // Fetch company by ID
      const response = await fetch('/api/companies');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch company');
      }

      const foundCompany = result.data.find((c: CompanyWithRelations) => c.id === id);
      if (!foundCompany) {
        throw new Error('Company not found');
      }

      setCompany(foundCompany);

      // Fetch properties that match this company's name
      const propertiesResponse = await fetch(
        `/api/companies/${foundCompany.id}/properties`
      );
      const propertiesResult = await propertiesResponse.json();

      if (propertiesResponse.ok) {
        setMatchedProperties(propertiesResult.data || []);
      }
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
          <div className="text-gray-400">Loading company details...</div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-900 rounded-lg p-4">
          <p className="text-red-400">Error: {error || 'Company not found'}</p>
        </div>
        <Link href="/companies" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
          ← Back to Companies
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/companies" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
          ← Back to Companies
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{company.company_name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="font-mono">NEQ: {company.neq}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                company.company_status === 'Immatriculée'
                  ? 'bg-green-900/30 text-green-400'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {company.company_status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Company Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Company Information</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-500">Registration Date</dt>
              <dd className="text-sm text-white">{company.registration_date || 'N/A'}</dd>
            </div>
            {company.domicile_address && (
              <div>
                <dt className="text-xs text-gray-500">Domicile Address</dt>
                <dd className="text-sm text-white">{company.domicile_address}</dd>
              </div>
            )}
            {company.cae_code && (
              <div>
                <dt className="text-xs text-gray-500">Economic Activity</dt>
                <dd className="text-sm text-white">{company.cae_code} - {company.cae_description}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Shareholders ({company.shareholders?.length || 0})</h3>
          <div className="space-y-3">
            {company.shareholders && company.shareholders.length > 0 ? (
              company.shareholders.map((shareholder, idx) => (
                <div key={idx} className="border-l-2 border-gray-700 pl-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-white">{shareholder.shareholder_name}</div>
                    {shareholder.is_majority_shareholder && (
                      <span className="text-yellow-500 text-xs">★ Majority</span>
                    )}
                  </div>
                  {shareholder.shareholder_type && (
                    <div className="text-xs text-gray-600 mt-1">Type: {shareholder.shareholder_type}</div>
                  )}
                  {shareholder.address ? (
                    shareholder.address_publishable ? (
                      <div className="text-xs text-gray-400 mt-1">{shareholder.address}</div>
                    ) : (
                      <div className="text-xs text-gray-600 mt-1 italic">Address not published</div>
                    )
                  ) : (
                    <div className="text-xs text-gray-600 mt-1 italic">No address on file</div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No shareholders listed</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Administrators ({company.administrators?.length || 0})</h3>
          <div className="space-y-4">
            {company.administrators && company.administrators.length > 0 ? (
              company.administrators.map((admin, idx) => (
                <div key={idx} className="border-l-2 border-gray-700 pl-3">
                  <div className="text-sm font-medium text-white">{admin.administrator_name}</div>
                  <div className="text-xs text-gray-500 mb-2">{admin.position_title}</div>

                  {/* Domicile Address */}
                  <div className="mt-2">
                    <div className="text-xs text-gray-600 font-medium">Home Address:</div>
                    {admin.domicile_address ? (
                      admin.domicile_address_publishable ? (
                        <div className="text-xs text-gray-400">{admin.domicile_address}</div>
                      ) : (
                        <div className="text-xs text-gray-600 italic">Not published</div>
                      )
                    ) : (
                      <div className="text-xs text-gray-600 italic">Not published</div>
                    )}
                  </div>

                  {/* Professional Address */}
                  <div className="mt-2">
                    <div className="text-xs text-gray-600 font-medium">Professional Address:</div>
                    {admin.professional_address ? (
                      admin.address_publishable ? (
                        <div className="text-xs text-gray-400">{admin.professional_address}</div>
                      ) : (
                        <div className="text-xs text-gray-600 italic">Not published</div>
                      )
                    ) : (
                      <div className="text-xs text-gray-600 italic">No address on file</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No administrators listed</p>
            )}
          </div>
        </div>
      </div>

      {/* Matched Properties */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Matched Properties ({matchedProperties.length})</h3>
        {matchedProperties.length > 0 ? (
          <div className="space-y-2">
            {matchedProperties.map((property, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-700/50 rounded-lg p-4">
                <div>
                  <div className="font-mono text-sm text-white">{property.matricule}</div>
                  <div className="text-xs text-gray-400 mt-1">{property.address}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Owner: {property.owner_name}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    property.matchType === 'exact'
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {property.matchType === 'exact' ? 'Exact Match' : 'Fuzzy Match'}
                  </span>
                  {property.evaluated_value && (
                    <span className="text-xs text-gray-400">
                      {new Intl.NumberFormat('en-CA', {
                        style: 'currency',
                        currency: 'CAD',
                        maximumFractionDigits: 0,
                      }).format(property.evaluated_value)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No properties matched to this company</p>
        )}
      </div>

    </div>
  );
}
