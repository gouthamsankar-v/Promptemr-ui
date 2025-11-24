"use client";

import { useState, useRef } from "react";

type Row = {
  'Patient ID': string;
  'First': string;
  'Last': string;
  'Case': string;
  'Clinic Location': string;
  'ProviderId': string;
  'Case Therapist/Provider': string;
  'Remote Care Navigator': string;
  '98975': string;
  '98975 Modifier': string;
  '98977': string;
  '989877 Modifier': string;
  '98980': string;
  '98980 Modifier': string;
  '98981': string;
  '98981 Modifier': string;
  'Comments': string;
  [key: string]: string;
};

type Result = {
  input: Row;
  success?: boolean;
  message?: string;
  access_token?: string;
  case_id?: string;
  organization_id?: string;
  person_id?: string;
  visit_id?: string;
  checkin_success?: boolean;
  start_visit_success?: boolean;
  treatments?: Array<{
    cpt_code: string;
    units: number;
    modifier?: string;
    success: boolean;
    message?: string;
  }>;
  error?: string;
};

function parseCSV(text: string): { headers: string[]; rows: Row[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  
  // Parse CSV with proper quote handling
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && (i === 0 || line[i-1] === ',')) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = parseLine(lines[0]);
  const rows: Row[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    // Skip empty rows
    if (cols.every(col => !col.trim())) continue;
    
    const row: Row = {} as Row;
    for (let j = 0; j < headers.length; j++) {
      row[headers[j] as keyof Row] = (cols[j] || "").replace(/^"|"$/g, "");
    }
    // Only add rows that have a Patient ID
    if (row['Patient ID'] && row['Patient ID'].trim()) {
      rows.push(row);
    }
  }
  return { headers, rows };
}



type LogEntry = {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'api';
  message: string;
  details?: any;
  patientId?: string;
};

export default function Home() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [logFilter, setLogFilter] = useState<LogEntry['type'] | 'all'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  const scrollToBottom = () => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Add log entry function
  const addLog = (type: LogEntry['type'], message: string, details?: any, patientId?: string) => {
    const logEntry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      message,
      details,
      patientId
    };
    setLogs(prev => [...prev, logEntry]);
    setTimeout(scrollToBottom, 100);
  };

  // Clear logs function
  const clearLogs = () => {
    setLogs([]);
  };

  // Helper function for log colors
  const getLogColorForType = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'api': return 'text-blue-400';
      case 'info':
      default: return 'text-gray-300';
    }
  };

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    addLog('info', `Loading CSV file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    const text = await file.text();
    const parsed = parseCSV(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setResults([]);
    setLogs([]); // Clear previous logs
    addLog('success', `CSV loaded successfully: ${parsed.rows.length} rows, ${parsed.headers.length} columns`);
  }

  async function processAll() {
    if (rows.length === 0) return;
    setProcessing(true);
    setProgress({ done: 0, total: rows.length });
    setLogs([]); // Clear previous logs
    const out: Result[] = [];

    addLog('info', `Starting RTM processing for ${rows.length} patients`);
    const startTime = performance.now();

    // First, get access token
    let accessToken: string;
    try {
      addLog('info', 'Attempting to authenticate with RTM system...');
      
      const loginResp = await fetch('http://localhost:5002/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: "rganapathy+wbhpt@carestack.com",
          password: "PromptVoicestack12345$"
        }),
      });
      
      addLog('api', `Login API call: POST /api/login - Status: ${loginResp.status}`, {
        status: loginResp.status,
        statusText: loginResp.statusText
      });
      
      if (!loginResp.ok) {
        throw new Error(`Login failed with status: ${loginResp.status}`);
      }
      
      const loginJson = await loginResp.json();
      addLog('success', 'Authentication successful', loginJson);
      accessToken = loginJson.data.tokens?.access_token;
      
      if (!accessToken) {
        throw new Error('Failed to get access token');
      }
      
      addLog('info', 'Access token obtained successfully');
    } catch (err: any) {
      const errorMsg = 'Login failed: ' + String(err?.message ?? err);
      addLog('error', errorMsg, err);
      setResults([{ 
        input: {} as Row, 
        success: false, 
        error: errorMsg
      }]);
      setProcessing(false);
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const patientName = `${row['First']} ${row['Last']}`;
      const patientId = row['Patient ID'];
      
      addLog('info', `Processing patient ${i + 1}/${rows.length}: ${patientName} (${patientId})`, null, patientId);
      
      const result: Result = {
        input: row,
        success: false,
        access_token: accessToken,
        treatments: []
      };

      try {
        // Step 1: Create patient workflow
        addLog('info', `Creating patient workflow for ${patientName}...`, null, patientId);
        
        const workflowPayload = {
          token: accessToken,
          patient_id: patientId,
          clinic_location: row['Clinic Location'],
          provider_id: row['ProviderId'],
          start_time: "2025/11/21/0100",
          end_time: "2025/11/21/0135",
          case: row['Case']
        };
        
        addLog('api', `Creating workflow: POST /api/patient-workflow`, workflowPayload, patientId);
        
        const workflowResp = await fetch('http://localhost:5002/api/patient-workflow', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(workflowPayload),
        });
        
        const workflowJson = await workflowResp.json();
        
        addLog('api', `Workflow API response: Status ${workflowResp.status}`, {
          status: workflowResp.status,
          response: workflowJson
        }, patientId);
        
        if (workflowJson.data) {
          result.case_id = workflowJson.data.case_id;
          result.organization_id = workflowJson.data.organization_id;
          result.person_id = workflowJson.data.person_id;
          result.visit_id = workflowJson.data.visit_id;
          
          addLog('success', `Workflow created successfully. Visit ID: ${result.visit_id}`, {
            case_id: result.case_id,
            visit_id: result.visit_id
          }, patientId);
        }

        if (!result.visit_id) {
          throw new Error('No visit_id received from patient-workflow');
        }

        // Step 2: Check-in
        addLog('info', `Checking in patient ${patientName}...`, null, patientId);
        
        const checkinPayload = {
          token: accessToken,
          visit_id: result.visit_id
        };
        
        addLog('api', `Check-in: PUT /api/check-in`, checkinPayload, patientId);
        
        const checkinResp = await fetch('http://localhost:5002/api/check-in', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(checkinPayload),
        });
        
        const checkinJson = await checkinResp.json();
        result.checkin_success = checkinResp.ok;
        
        addLog('api', `Check-in API response: Status ${checkinResp.status}`, {
          status: checkinResp.status,
          response: checkinJson
        }, patientId);
        
        if (result.checkin_success) {
          addLog('success', `Patient checked in successfully`, null, patientId);
        } else {
          addLog('warning', `Check-in failed: ${checkinJson.message || 'Unknown error'}`, checkinJson, patientId);
        }

        // Step 3: Start visit
        addLog('info', `Starting visit for ${patientName}...`, null, patientId);
        
        const startVisitPayload = {
          token: accessToken,
          visit_id: result.visit_id
        };
        
        addLog('api', `Start visit: PUT /api/start-visit`, startVisitPayload, patientId);
        
        const startVisitResp = await fetch('http://localhost:5002/api/start-visit', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(startVisitPayload),
        });
        
        const startVisitJson = await startVisitResp.json();
        result.start_visit_success = startVisitResp.ok;
        
        addLog('api', `Start visit API response: Status ${startVisitResp.status}`, {
          status: startVisitResp.status,
          response: startVisitJson
        }, patientId);
        
        if (result.start_visit_success) {
          addLog('success', `Visit started successfully`, null, patientId);
        } else {
          addLog('warning', `Start visit failed: ${startVisitJson.message || 'Unknown error'}`, startVisitJson, patientId);
        }

        // Step 4: Add treatments for each CPT code with units
        const cptCodes = [
          { code: '98975', units: row['98975'], modifier: row['98975 Modifier'] },
          { code: '98977', units: row['98977'], modifier: row['989877 Modifier'] },
          { code: '98980', units: row['98980'], modifier: row['98980 Modifier'] },
          { code: '98981', units: row['98981'], modifier: row['98981 Modifier'] }
        ];

        addLog('info', `Processing ${cptCodes.filter(cpt => parseFloat(cpt.units) > 0).length} treatments...`, null, patientId);

        for (const cpt of cptCodes) {
          const units = parseFloat(cpt.units);
          if (units > 0) {
            try {
              addLog('info', `Adding treatment: ${cpt.code} (${units} units)${cpt.modifier && cpt.modifier !== 'no' ? ` with modifier ${cpt.modifier}` : ''}`, null, patientId);
              
              const treatmentPayload = {
                token: accessToken,
                cpt_code: cpt.code,
                modifier_order: cpt.modifier && cpt.modifier !== 'no' ? [cpt.modifier] : [],
                units: units,
                exercise_details: row['Comments']
              };
              
              addLog('api', `Adding treatment: PUT /api/visits/${result.visit_id}/treatment`, treatmentPayload, patientId);
              
              const treatmentResp = await fetch(`http://localhost:5002/api/visits/${result.visit_id}/treatment`, {
                method: 'PUT',
                headers: { 
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(treatmentPayload),
              });
              
              const treatmentJson = await treatmentResp.json();
              
              addLog('api', `Treatment API response: Status ${treatmentResp.status}`, {
                status: treatmentResp.status,
                response: treatmentJson
              }, patientId);
              
              const treatmentSuccess = treatmentResp.ok;
              result.treatments?.push({
                cpt_code: cpt.code,
                units: units,
                modifier: cpt.modifier !== 'no' ? cpt.modifier : undefined,
                success: treatmentSuccess,
                message: treatmentJson.message
              });
              
              if (treatmentSuccess) {
                addLog('success', `Treatment ${cpt.code} added successfully`, null, patientId);
              } else {
                addLog('error', `Treatment ${cpt.code} failed: ${treatmentJson.message || 'Unknown error'}`, treatmentJson, patientId);
              }
            } catch (treatmentErr: any) {
              const errorMsg = String(treatmentErr?.message ?? treatmentErr);
              addLog('error', `Treatment ${cpt.code} error: ${errorMsg}`, treatmentErr, patientId);
              result.treatments?.push({
                cpt_code: cpt.code,
                units: units,
                modifier: cpt.modifier !== 'no' ? cpt.modifier : undefined,
                success: false,
                message: errorMsg
              });
            }
          }
        }

        result.success = true;
        result.message = 'Processing completed successfully';
        addLog('success', `Patient ${patientName} processed successfully with ${result.treatments?.filter(t => t.success).length || 0} treatments`, null, patientId);

      } catch (err: any) {
        const errorMsg = String(err?.message ?? err);
        result.error = errorMsg;
        result.message = 'Processing failed: ' + errorMsg;
        addLog('error', `Patient ${patientName} processing failed: ${errorMsg}`, err, patientId);
      }
      
      out.push(result);
      setProgress((p) => ({ done: p.done + 1, total: p.total }));
      
      // Add a small delay to make the processing more visible in logs
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successCount = out.filter(r => r.success).length;
    const failureCount = out.filter(r => !r.success).length;
    const totalTreatments = out.reduce((sum, r) => sum + (r.treatments?.filter(t => t.success).length || 0), 0);
    const endTime = performance.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);
    
    addLog('success', `RTM processing completed in ${totalTime}s: ${successCount} successful, ${failureCount} failed, ${totalTreatments} treatments added`, {
      totalTime,
      successRate: `${((successCount / out.length) * 100).toFixed(1)}%`,
      averageTimePerPatient: `${(parseFloat(totalTime) / out.length).toFixed(2)}s`
    });

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
      results: results,
      logs: logs // Include logs in the export
    };
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rtm-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadLogs() {
    if (logs.length === 0) return;
    const logData = {
      metadata: {
        totalLogs: logs.length,
        exportDate: new Date().toISOString(),
        logTypes: [...new Set(logs.map(l => l.type))]
      },
      logs: logs
    };
    const jsonString = JSON.stringify(logData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rtm-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            RTM Data Processing Platform
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload RTM CSV data to process patient workflows, create visits, and add treatment codes automatically
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">RTM Processing Controls</h3>
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
              'Process RTM Data'
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
            
            <button 
              onClick={downloadLogs} 
              disabled={logs.length === 0}
              className={`
                px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2
                ${logs.length === 0 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Export Logs
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

      {/* Live Logs Section */}
      {(processing || logs.length > 0) && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-gray-800">Live Processing Logs</h3>
              {processing && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600 font-medium">Live</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm text-gray-600">
                {logs.filter(log => {
                  const matchesFilter = logFilter === 'all' || log.type === logFilter;
                  const matchesSearch = logSearch === '' || 
                    log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
                    (log.patientId && log.patientId.toLowerCase().includes(logSearch.toLowerCase()));
                  return matchesFilter && matchesSearch;
                }).length} of {logs.length} entries
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 w-32 bg-white"
                  disabled={processing}
                />
                <label className="text-xs text-gray-600">Filter:</label>
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as LogEntry['type'] | 'all')}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                  disabled={processing}
                >
                  <option value="all">All ({logs.length})</option>
                  <option value="info">Info ({logs.filter(l => l.type === 'info').length})</option>
                  <option value="api">API ({logs.filter(l => l.type === 'api').length})</option>
                  <option value="success">Success ({logs.filter(l => l.type === 'success').length})</option>
                  <option value="warning">Warning ({logs.filter(l => l.type === 'warning').length})</option>
                  <option value="error">Error ({logs.filter(l => l.type === 'error').length})</option>
                </select>
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    autoScroll 
                      ? 'bg-green-100 border-green-300 text-green-700' 
                      : 'bg-gray-100 border-gray-300 text-gray-600'
                  }`}
                  title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
                >
                  {autoScroll ? '📍' : '📌'}
                </button>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showLogs ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                  </svg>
                  {showLogs ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={clearLogs}
                  disabled={processing}
                  className="text-sm text-red-600 hover:text-red-800 font-medium disabled:text-gray-400 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear
                </button>
              </div>
            </div>
          </div>
          
          {showLogs && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Log Statistics */}
              <div className="lg:col-span-1">
                <div className="bg-gray-800 rounded-lg p-3 mb-4">
                  <h4 className="text-gray-200 font-semibold text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Statistics
                  </h4>
                  <div className="space-y-2 text-xs">
                    {(['info', 'api', 'success', 'warning', 'error'] as const).map(type => {
                      const count = logs.filter(log => log.type === type).length;
                      const percentage = logs.length > 0 ? (count / logs.length * 100).toFixed(1) : '0';
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`capitalize ${count > 0 ? getLogColorForType(type) : 'text-gray-500'} flex items-center gap-1`}>
                              <span className="w-2 h-2 rounded-full" style={{backgroundColor: count > 0 ? getLogColorForType(type).replace('text-', '').replace('400', '') : '#6B7280'}}></span>
                              {type}
                            </span>
                            <span className="text-gray-300 font-mono">{count}</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1">
                            <div 
                              className={`h-1 rounded-full transition-all duration-300 ${getLogColorForType(type).replace('text-', 'bg-')}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-gray-700">
                      <div className="flex justify-between text-gray-300">
                        <span>Total:</span>
                        <span className="font-mono font-semibold">{logs.length}</span>
                      </div>
                      {processing && (
                        <div className="flex justify-between text-blue-400 mt-1">
                          <span>Rate:</span>
                          <span className="font-mono text-xs">
                            {logs.length > 0 ? `${(logs.length / ((performance.now() - Date.now()) / 1000 + 1)).toFixed(1)}/s` : '0/s'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setLogFilter('error')}
                        disabled={logs.filter(l => l.type === 'error').length === 0}
                        className="text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-2 py-1 rounded transition-colors"
                      >
                        Jump to Errors ({logs.filter(l => l.type === 'error').length})
                      </button>
                      <button
                        onClick={() => setLogFilter('api')}
                        disabled={logs.filter(l => l.type === 'api').length === 0}
                        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-2 py-1 rounded transition-colors"
                      >
                        Show API Calls ({logs.filter(l => l.type === 'api').length})
                      </button>
                      <button
                        onClick={() => {
                          setLogFilter('all');
                          setLogSearch('');
                        }}
                        className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded transition-colors"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Logs Display */}
              <div className="lg:col-span-3">
                <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
                  {logs
                    .filter(log => {
                      const matchesFilter = logFilter === 'all' || log.type === logFilter;
                      const matchesSearch = logSearch === '' || 
                        log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
                        (log.patientId && log.patientId.toLowerCase().includes(logSearch.toLowerCase()));
                      return matchesFilter && matchesSearch;
                    })
                    .map((log) => (
                      <LogEntryComponent key={log.id} log={log} searchTerm={logSearch} />
                    ))}
                  <div ref={logsEndRef} />
                  {logs.length === 0 && (
                    <div className="text-gray-500 text-center py-4">No logs yet...</div>
                  )}
                  {logs.length > 0 && logs.filter(log => {
                    const matchesFilter = logFilter === 'all' || log.type === logFilter;
                    const matchesSearch = logSearch === '' || 
                      log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
                      (log.patientId && log.patientId.toLowerCase().includes(logSearch.toLowerCase()));
                    return matchesFilter && matchesSearch;
                  }).length === 0 && (
                    <div className="text-gray-500 text-center py-4">
                      No logs match your filter criteria.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      {results.length > 0 && !processing && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-800">RTM Processing Results</h3>
            <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
              {results.length} patients processed
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
                {results.filter(r => r.visit_id).length}
              </div>
              <div className="text-sm text-blue-700 font-medium">Visits Created</div>
            </div>
            
            <div className="text-center p-6 bg-purple-50 rounded-xl border border-purple-200">
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {results.reduce((sum, r) => sum + (r.treatments?.length || 0), 0)}
              </div>
              <div className="text-sm text-purple-700 font-medium">Treatments Added</div>
            </div>
          </div>
        </div>
      )}

      {/* RTM Results Table */}
      {results.length > 0 && (
        <RTMResultsDashboard results={results} />
      )}

      </div>
    </div>
  );
}

// RTM Results Dashboard Component
function RTMResultsDashboard({ results }: { results: Result[] }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
  
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-800">Detailed Results</h3>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Detailed Results
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid gap-4">
          {results.map((result, index) => (
            <RTMResultCard key={index} result={result} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visit ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Treatments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {result.input['First']} {result.input['Last']}
                    </div>
                    <div className="text-sm text-gray-500">
                      {result.input['Patient ID']}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      result.success
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {result.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {result.visit_id ? result.visit_id.slice(-12) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {result.treatments?.length || 0} treatments
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {result.message || result.error || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// RTM Result Card Component
function RTMResultCard({ result }: { result: Result }) {
  return (
    <div className={`border rounded-lg p-4 ${
      result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">
            {result.input['First']} {result.input['Last']}
          </h4>
          <p className="text-sm text-gray-600">
            {result.input['Patient ID']} - {result.input['Case']}
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          result.success
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {result.success ? 'Success' : 'Failed'}
        </span>
      </div>
      
      {result.success ? (
        <div className="space-y-2 text-sm">
          {result.visit_id && (
            <div className="flex justify-between">
              <span className="text-gray-600">Visit ID:</span>
              <span className="font-mono text-xs">{result.visit_id.slice(-12)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Check-in:</span>
            <span className={result.checkin_success ? 'text-green-600' : 'text-red-600'}>
              {result.checkin_success ? '✓ Success' : '✗ Failed'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Visit Started:</span>
            <span className={result.start_visit_success ? 'text-green-600' : 'text-red-600'}>
              {result.start_visit_success ? '✓ Success' : '✗ Failed'}
            </span>
          </div>
          {result.treatments && result.treatments.length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-gray-600 text-sm font-medium">Treatments Added:</span>
              <div className="mt-1 space-y-1 text-stone-700">
                {result.treatments.map((treatment, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>
                      {treatment.cpt_code}
                      {treatment.modifier && ` (${treatment.modifier})`}
                      : {treatment.units} units
                    </span>
                    <span className={treatment.success ? 'text-green-600' : 'text-red-600'}>
                      {treatment.success ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-red-700">
          <strong>Error:</strong> {result.error || result.message}
        </div>
      )}
    </div>
  );
}

// Log Entry Component
function LogEntryComponent({ log, searchTerm = '' }: { log: LogEntry; searchTerm?: string }) {
  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'api': return 'text-blue-400';
      case 'info':
      default: return 'text-gray-300';
    }
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'warning': return '⚠';
      case 'api': return '🔄';
      case 'info':
      default: return 'ℹ';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Highlight search terms
  const highlightText = (text: string, search: string) => {
    if (!search) return text;
    const regex = new RegExp(`(${search})`, 'gi');
    return text.split(regex).map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-600 text-black px-1 rounded">
          {part}
        </span>
      ) : part
    );
  };

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2 text-xs">
      <div className="flex items-start gap-2">
        <span className="text-gray-500 font-mono">{formatTime(log.timestamp)}</span>
        <span className={getLogColor(log.type)}>{getLogIcon(log.type)}</span>
        <span className={`${getLogColor(log.type)} flex-1`}>
          {log.patientId && (
            <span className="text-purple-400 font-semibold">
              [{highlightText(log.patientId, searchTerm)}]{' '}
            </span>
          )}
          {highlightText(log.message, searchTerm)}
        </span>
        {log.details && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-200 ml-2"
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
      </div>
      {expanded && log.details && (
        <div className="mt-1 ml-16 p-2 bg-gray-800 rounded text-gray-300 overflow-auto max-h-32">
          <pre className="text-xs whitespace-pre-wrap">
            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
