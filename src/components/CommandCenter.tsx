'use client';

import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { TransactionLog } from '../lib/types';
import { ShieldCheck, Eye, Terminal, AlertTriangle, CheckCircle2, XCircle, PauseCircle, PlayCircle } from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

interface CommandCenterProps {
  logs: TransactionLog[];
  onToggleProjectFreeze?: (projectId: string) => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ logs, onToggleProjectFreeze }) => {
  const [selectedLog, setSelectedLog] = useState<TransactionLog | null>(null);

  const columnDefs: ColDef<TransactionLog>[] = [
    {
      field: 'timestamp',
      headerName: 'Time',
      width: 90,
      valueFormatter: (params) => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
    },
    {
      field: 'projectName',
      headerName: 'Project / Contract',
      width: 170,
      cellRenderer: (params: any) => {
        return (
          <span className="font-semibold text-slate-200 text-xs">
            {params.value || 'General'}
          </span>
        );
      },
    },
    {
      field: 'agentRole',
      headerName: 'Actor',
      width: 130,
      cellRenderer: (params: any) => {
        const role = params.value;
        let colorClass = 'bg-slate-700 text-slate-200';
        if (role === 'BUYER_AI') colorClass = 'bg-blue-950 text-blue-300 border-blue-700/50';
        if (role === 'SELLER_AI') colorClass = 'bg-purple-950 text-purple-300 border-purple-700/50';
        if (role === 'GUARDRAIL') colorClass = 'bg-amber-950 text-amber-300 border-amber-700/50';
        if (role === 'PAYPAL_API') colorClass = 'bg-emerald-950 text-emerald-300 border-emerald-700/50';
        
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${colorClass}`}>
            {role === 'BUYER_AI' ? 'BUYER AGENT' : role === 'SELLER_AI' ? 'SELLER AGENT' : role === 'GUARDRAIL' ? 'GUARDRAIL' : 'PAYPAL ESCROW'}
          </span>
        );
      },
    },
    {
      field: 'action',
      headerName: 'Milestone / Transaction Action',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'amountUSD',
      headerName: 'Amount',
      width: 100,
      valueFormatter: (params) => `$${params.value?.toFixed(2) || '0.00'}`,
      cellClass: 'font-semibold text-emerald-400',
    },
    {
      field: 'auditConfidenceScore',
      headerName: 'Audit',
      width: 90,
      cellRenderer: (params: any) => {
        const score = params.value;
        const color = score >= 85 ? 'text-emerald-400' : 'text-amber-400';
        return <span className={`font-bold ${color}`}>{score}%</span>;
      },
    },
    {
      field: 'riskLevel',
      headerName: 'Risk',
      width: 100,
      cellRenderer: (params: any) => {
        const risk = params.value;
        let badge = 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30';
        if (risk === 'MEDIUM') badge = 'bg-yellow-900/40 text-yellow-300 border-yellow-500/30';
        if (risk === 'HIGH') badge = 'bg-orange-900/40 text-orange-300 border-orange-500/30';
        if (risk === 'CRITICAL') badge = 'bg-red-900/50 text-red-300 border-red-500/40 animate-pulse';
        
        return (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge}`}>
            {risk}
          </span>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      cellRenderer: (params: any) => {
        const status = params.value;
        let icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1" />;
        let textClass = 'text-emerald-400';
        
        if (status === 'REJECTED' || status === 'KILL_SWITCH_REVOKED' || status === 'CONTRACT_FROZEN') {
          icon = <XCircle className="w-3.5 h-3.5 text-red-400 mr-1" />;
          textClass = 'text-red-400';
        } else if (status === 'GUARDRAIL_CHECKING' || status === 'AUDITING_DELIVERABLE') {
          icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mr-1 animate-spin" />;
          textClass = 'text-amber-400';
        }

        return (
          <div className={`flex items-center text-xs font-medium ${textClass}`}>
            {icon}
            <span>{status}</span>
          </div>
        );
      },
    },
    {
      headerName: 'Actions',
      width: 120,
      cellRenderer: (params: any) => {
        const log = params.data;
        if (!log) return null;

        return (
          <div className="flex items-center gap-1.5">
            {log.httpPayloadLog && (
              <button
                onClick={() => setSelectedLog(log)}
                className="flex items-center gap-1 bg-[#252830] hover:bg-amber-500/10 text-amber-400 text-xs px-2 py-1 rounded border border-amber-500/30 transition-all"
                title="View PayPal REST Payload"
              >
                <Eye className="w-3 h-3" />
              </button>
            )}

            {onToggleProjectFreeze && log.projectId && (
              <button
                onClick={() => onToggleProjectFreeze(log.projectId)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-amber-950/60 text-amber-400 text-xs px-2 py-1 rounded border border-amber-500/30 transition-all"
                title="Freeze/Resume This Project Escrow"
              >
                <PauseCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="bg-[#16181D] border border-amber-500/20 rounded-xl p-5 shadow-2xl flex flex-col h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">
            Multi-Contract Audit Ledger
          </h2>
        </div>
        <div className="text-xs text-slate-400">
          Total Logs: <strong className="text-amber-400 font-mono">{logs.length}</strong>
        </div>
      </div>

      {/* AG Grid Table Container */}
      <div className="ag-theme-quartz-dark w-full h-[410px] rounded-lg overflow-hidden border border-amber-500/10">
        <AgGridReact
          rowData={logs}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          pagination={true}
          paginationPageSize={10}
          animateRows={true}
        />
      </div>

      {/* Transaction Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16181D] border border-amber-500/30 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#252830] pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Terminal className="w-5 h-5" />
                <h3 className="font-bold text-lg text-white">
                  Escrow Settlement Detail ({selectedLog.projectName})
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white font-bold px-2.5 py-1 rounded bg-[#252830]"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div><strong>Project:</strong> <span className="text-amber-400 font-bold">{selectedLog.projectName}</span></div>
              <div><strong>Action:</strong> {selectedLog.action}</div>
              <div><strong>Recipient:</strong> <span className="text-slate-200">{selectedLog.recipientEmail}</span></div>
              <div><strong>PayPal Settlement Ref:</strong> <span className="font-mono text-emerald-400">{selectedLog.payPalTransactionId || 'N/A'}</span></div>
            </div>

            <div className="bg-[#0F1115] p-4 rounded-lg border border-amber-500/20 font-mono text-xs text-amber-300 overflow-x-auto max-h-60">
              <pre>{selectedLog.httpPayloadLog}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
