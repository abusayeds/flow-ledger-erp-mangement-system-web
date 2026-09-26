/**
 * File: src/App.tsx
 * Clean Professional Layout - Matching Figma Design
 */

import React, { useState } from "react";
import "./App.css";
import { BrowserRouter } from "react-router-dom";

import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";

const OldApp: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-white">
        {/* Sidebar */}
        <Sidebar
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-[#F8F9FA]">
            <div className="p-6">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  Welcome to Qayd Invoice Management
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-sm text-gray-600 mb-1">
                    Total Revenue
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">
                    $48,574
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    +12.5% from last month
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-sm text-gray-600 mb-1">
                    Invoices Sent
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">
                    142
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    +8 from last month
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-sm text-gray-600 mb-1">
                    Pending Payments
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">
                    $12,450
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    23 invoices pending
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-sm text-gray-600 mb-1">
                    Overdue Amount
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">
                    $3,200
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    5 invoices overdue
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Recent Invoices
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">
                          Invoice #
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">
                          Customer
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">
                          Date
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">
                          Amount
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          INV-001
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          Acme Corporation
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          Apr 10, 2026
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          $2,450.00
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            Paid
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          INV-002
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          Tech Solutions Ltd
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          Apr 12, 2026
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          $5,800.00
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            Pending
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          INV-003
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          Global Enterprises
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          Apr 14, 2026
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          $1,200.00
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                            Overdue
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          INV-004
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          Digital Marketing Co
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          Apr 15, 2026
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          $3,650.00
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            Sent
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default OldApp;
