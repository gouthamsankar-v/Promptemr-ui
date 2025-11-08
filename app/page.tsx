"use client";

import { useState, useRef } from "react";

type Row = { [key: string]: string };
type Result = {
  input: Row;
  success?: boolean;
  message?: string;
  cookie_count?: number;
  current_url?: string;
  access_token?: string;
  visit_data?: any; // Store the entire visit data as JSON
  visit_status?: string;
  visit_timestamp?: string;
  visit_url?: string;
  visit_title?: string;
  visit_error?: string;
  visits_data?: any; // Store the entire visits_data as JSON
};

function parseCSV(text: string): { headers: string[]; rows: Row[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cols[j] || "").trim().replace(/^\"|\"$/g, "");
    }
    rows.push(row);
  }
  return { headers, rows };
}



export default function Home() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setResults([]);
  }

  async function processAll() {
    if (rows.length === 0) return;
    setProcessing(true);
    setProgress({ done: 0, total: rows.length });
    const out: Result[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const resp = await fetch('http://localhost:5002/api/login', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            email: row.email || '',
            password: row.password || '',
            name: row.name || '',
            headless: row.headless === 'true' || false
          }),
        });
        const json = await resp.json();
        // Support both proxied and direct shape
        const data = json.data ?? json;
        const visitData = data?.visit_data || data?.visit || null;
        const visitsData = data?.visits_data || null;
        
        const result: Result = {
          input: row,
          success: json.success ?? true,
          message: json.message ?? undefined,
          cookie_count: data?.cookie_count ?? undefined,
          current_url: data?.current_url ?? undefined,
          access_token: data?.tokens?.access_token ?? undefined,
          visit_data: visitData ? JSON.stringify(visitData) : undefined,
          visit_status: visitData?.status ?? undefined,
          visit_timestamp: visitData?.timestamp ?? undefined,
          visit_url: visitData?.url ?? undefined,
          visit_title: visitData?.title ?? undefined,
          visit_error: visitData?.error ?? undefined,
          visits_data: visitsData ? JSON.stringify(visitsData) : undefined,
        };
        out.push(result);
      } catch (err: any) {
        out.push({ 
          input: row, 
          success: false, 
          message: String(err?.message ?? err),
          visit_error: 'Request failed: ' + String(err?.message ?? err)
        });
      }
      setProgress((p) => ({ done: p.done + 1, total: p.total }));
    }

    setResults(out);
    setProcessing(false);
  }



  function downloadJSON() {
    if (results.length === 0) return;
    const jsonData = {
      metadata: {
        totalRows: results.length,
        exportDate: new Date().toISOString(),
        originalHeaders: headers
      },
      results: results
    };
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Data Processing Platform
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload, process, and analyze your data with powerful automation tools
          </p>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Your Data File</h3>
            <p className="text-gray-600 mb-6">Select a CSV file to begin processing</p>
            
            <label className="relative cursor-pointer">
              <input 
                ref={fileRef} 
                type="file" 
                accept=".csv,text/csv" 
                onChange={handleFile}
                className="sr-only"
              />
              <div className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 inline-flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Choose File
              </div>
            </label>
          </div>
        </div>

      {headers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Data Preview</h3>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {rows.length} rows loaded
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.slice(0, 10).map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {headers.map((h) => (
                        <td key={h} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 10 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Showing first 10 rows of {rows.length} total rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Controls</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Processing Button */}
          <button 
            onClick={processAll} 
            disabled={processing || rows.length === 0}
            className={`
              flex-1 sm:flex-none px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 
              ${processing || rows.length === 0 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
              }
            `}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Start Processing'
            )}
          </button>

          {/* Download Button */}
          <div className="flex gap-3">
            <button 
              onClick={downloadJSON} 
              disabled={results.length === 0}
              className={`
                px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2
                ${results.length === 0 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Download Results
            </button>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {processing && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Processing Progress</h3>
            <span className="text-sm text-gray-600">{progress.done} of {rows.length} completed</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(progress.done / rows.length) * 100}%` }}
            ></div>
          </div>
          
          {/* Progress Stats */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              {Math.round((progress.done / rows.length) * 100)}% Complete
            </span>
            <span className="text-blue-600 font-medium">
              {rows.length - progress.done} remaining
            </span>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {results.length > 0 && !processing && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-800">Processing Complete</h3>
            <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
              {results.length} results
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-green-50 rounded-xl border border-green-200">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {results.filter(r => r.success).length}
              </div>
              <div className="text-sm text-green-700 font-medium">Successful</div>
            </div>
            
            <div className="text-center p-6 bg-red-50 rounded-xl border border-red-200">
              <div className="text-3xl font-bold text-red-600 mb-1">
                {results.filter(r => !r.success).length}
              </div>
              <div className="text-sm text-red-700 font-medium">Failed</div>
            </div>
            
            <div className="text-center p-6 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {results.filter(r => r.visits_data).length}
              </div>
              <div className="text-sm text-blue-700 font-medium">With Visits</div>
            </div>
            
            <div className="text-center p-6 bg-purple-50 rounded-xl border border-purple-200">
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {results.filter(r => r.access_token).length}
              </div>
              <div className="text-sm text-purple-700 font-medium">With Tokens</div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden basic results table - replaced with modern UI below */}
      {false && results.length > 0 && (
        <div>
          <h3>Results ({results.length})</h3>
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>{h}</th>
                  ))}
                  <th style={{ padding: 6, borderBottom: '1px solid #ddd' }}>success</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #ddd' }}>message</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #ddd' }}>visit_status</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #ddd' }}>visit_url</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} style={{ padding: 6, borderBottom: '1px solid #f4f4f4' }}>{r.input[h]}</td>
                    ))}
                    <td style={{ padding: 6, borderBottom: '1px solid #f4f4f4', color: r.success ? 'green' : 'red' }}>
                      {String(r.success)}
                    </td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f4f4f4' }}>{r.message}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f4f4f4' }}>{r.visit_status || r.visit_error || '-'}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f4f4f4' }}>{r.visit_url || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modern Visit Data UI with Tabbed Interface */}
      {results.length > 0 && results.some(r => r.visits_data) && (
        <VisitDataDashboard results={results} />
      )}

      </div>
    </div>
  );
}

// Visit Data Dashboard Component with Tabs
function VisitDataDashboard({ results }: { results: Result[] }) {
  const [activeTab, setActiveTab] = useState<'inProgress' | 'incomplete' | 'upcoming'>('inProgress');
  
  // Aggregate all visit data from all results
  const aggregatedData = results.reduce((acc, result) => {
    if (!result.visits_data) return acc;
    
    try {
      const visitsData = JSON.parse(result.visits_data);
      
      if (visitsData.inProgress) {
        acc.inProgress.push(...visitsData.inProgress.map((visit: any) => ({
          ...visit,
          sourceEmail: result.input.email,
          loginSuccess: result.success
        })));
      }
      
      if (visitsData.incomplete) {
        acc.incomplete.push(...visitsData.incomplete.map((visit: any) => ({
          ...visit,
          sourceEmail: result.input.email,
          loginSuccess: result.success
        })));
      }
      
      if (visitsData.upcoming) {
        acc.upcoming.push(...visitsData.upcoming.map((visit: any) => ({
          ...visit,
          sourceEmail: result.input.email,
          loginSuccess: result.success
        })));
      }
    } catch (e) {
      console.error('Error parsing visit data:', e);
    }
    
    return acc;
  }, {
    inProgress: [] as any[],
    incomplete: [] as any[],
    upcoming: [] as any[]
  });

  const tabs = [
    {
      id: 'inProgress' as const,
      label: 'In Progress',
      count: aggregatedData.inProgress.length,
      color: 'blue',
      data: aggregatedData.inProgress
    },
    {
      id: 'incomplete' as const,
      label: 'Incomplete',
      count: aggregatedData.incomplete.length,
      color: 'orange',
      data: aggregatedData.incomplete
    },
    {
      id: 'upcoming' as const,
      label: 'Upcoming',
      count: aggregatedData.upcoming.length,
      color: 'green',
      data: aggregatedData.upcoming
    }
  ];

  const getTabStyle = (tabId: string, color: string) => {
    const isActive = activeTab === tabId;
    const baseStyle = "flex-1 sm:flex-none px-4 sm:px-6 py-3 font-medium text-sm rounded-lg transition-all duration-200 flex items-center justify-center gap-2 min-w-0";
    
    if (isActive) {
      const colorMap = {
        blue: 'bg-blue-500 text-white shadow-lg',
        orange: 'bg-orange-500 text-white shadow-lg',
        green: 'bg-green-500 text-white shadow-lg'
      };
      return `${baseStyle} ${colorMap[color as keyof typeof colorMap]}`;
    } else {
      const colorMap = {
        blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200',
        orange: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200',
        green: 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
      };
      return `${baseStyle} ${colorMap[color as keyof typeof colorMap]}`;
    }
  };

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="mt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Visit Data Dashboard</h2>
        
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{aggregatedData.inProgress.length}</div>
            <div className="text-sm text-blue-700">In Progress</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">{aggregatedData.incomplete.length}</div>
            <div className="text-sm text-orange-700">Incomplete</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-600">{aggregatedData.upcoming.length}</div>
            <div className="text-sm text-green-700">Upcoming</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-600">
              {aggregatedData.inProgress.length + aggregatedData.incomplete.length + aggregatedData.upcoming.length}
            </div>
            <div className="text-sm text-gray-700">Total Visits</div>
          </div>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          Data from {results.filter(r => r.visits_data).length} successfully processed accounts
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={getTabStyle(tab.id, tab.color)}
          >
            <span className={`w-2 h-2 rounded-full ${
              tab.color === 'blue' ? 'bg-blue-400' : 
              tab.color === 'orange' ? 'bg-orange-400' : 
              'bg-green-400'
            } ${activeTab === tab.id ? 'bg-white' : ''}`}></span>
            {tab.label}
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
              activeTab === tab.id ? 'bg-white bg-opacity-20' : 'bg-gray-200 text-gray-700'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        {activeTabData && activeTabData.count > 0 ? (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {activeTabData.label} Visits ({activeTabData.count})
              </h3>
              <p className="text-sm text-gray-600">
                Showing all {activeTabData.label.toLowerCase()} visits from processed accounts
              </p>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {activeTabData.data.map((visit: any) => (
                <VisitCard key={`${visit.VisitId}-${visit.sourceEmail}`} visit={visit} showSource={true} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No {activeTabData?.label.toLowerCase()} visits</h3>
            <p className="text-gray-500">
              There are currently no visits in the {activeTabData?.label.toLowerCase()} category.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Visit Card Component
function VisitCard({ visit, showSource = false }: { visit: any; showSource?: boolean }) {
  const getVisitTypeColor = (color: string) => {
    const colorMap: Record<string, string> = {
      'moss': 'bg-green-100 text-green-800 border-green-200',
      'blue': 'bg-blue-100 text-blue-800 border-blue-200',
      'orange': 'bg-orange-100 text-orange-800 border-orange-200',
      'purple': 'bg-purple-100 text-purple-800 border-purple-200',
      'green': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    return colorMap[color] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    // Format from "2025/11/07/0204" to readable format
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h5 className="font-semibold text-gray-900 text-sm">
          {visit.preferredName} {visit.LastName}
        </h5>
        <span className={`px-2 py-1 rounded text-xs font-medium border ${getVisitTypeColor(visit.visitTypeColor)}`}>
          {visit.visitType}
        </span>
      </div>
      
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Visit ID:</span>
          <span className="font-mono text-xs">{visit.VisitId?.slice(-8)}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDate(visit.Start)}</span>
        </div>
        <div className="flex justify-between">
          <span>Place:</span>
          <span>{visit.PlaceOfService}</span>
        </div>
        <div className="flex justify-between">
          <span>Insurance:</span>
          <span className="uppercase">{visit.insuranceType || 'N/A'}</span>
        </div>
        {visit.hasNotes && (
          <div className="flex justify-between">
            <span>Notes:</span>
            <span className="text-green-600">✓ Has notes</span>
          </div>
        )}
        {visit.Stage && (
          <div className="flex justify-between">
            <span>Stage:</span>
            <span className="capitalize">{visit.Stage}</span>
          </div>
        )}
        {showSource && visit.sourceEmail && (
          <div className="flex justify-between pt-1 border-t border-gray-200 mt-2">
            <span>Account:</span>
            <span className="text-blue-600 text-xs font-medium">{visit.sourceEmail}</span>
          </div>
        )}
        {showSource && visit.loginSuccess !== undefined && (
          <div className="flex justify-between">
            <span>Login Status:</span>
            <span className={`text-xs font-medium ${
              visit.loginSuccess ? 'text-green-600' : 'text-red-600'
            }`}>
              {visit.loginSuccess ? '✓ Success' : '✗ Failed'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
