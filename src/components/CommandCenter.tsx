'use client';

import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { TransactionLog } from '../lib/types';
import { ShieldCheck, Eye, Terminal, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

interface CommandCenterProps {
  logs: TransactionLog[];
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ logs }) => {
  const [selectedLog, setSelectedLog] = useState<TransactionLog | null>(null);

  const columnDefs: ColDef<TransactionLog>[] = [
    {
      field: 'timestamp',
      headerName: 'Time',
      width: 100,
      valueFormatter: (params) => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            {role === 'BUYER_AI' ? 'BUYER AGENT' : role === 'SELLER_AI' ? 'SELLER AGENT' : role === 'GUARDRAIL' ? 'SECURITY GUARD' : 'PAYPAL ESCROW'}
          </span>
        );
      },
    },
    {
      field: 'action',
      headerName: 'Transaction / Milestone Action',
      flex: 1,
      minWidth: 220,
    },
    {
      field: 'amountUSD',
      headerName: 'Amount',
      width: 110,
      valueFormatter: (params) => `$${params.value?.toFixed(2) || '0.00'}`,
      cellClass: 'font-semibold text-emerald-400',
    },
    {
      field: 'auditConfidenceScore',
      headerName: 'Audit Score',
      width: 110,
      cellRenderer: (params: any) => {
        const score = params.value;
        const color = score >= 85 ? 'text-emerald-400' : 'text-amber-400';
        return <span className={`font-bold ${color}`}>{score}%</span>;
      },
    },
    {
      field: 'riskLevel',
      headerName: 'Risk Level',
      width: 110,
      cellRenderer: (params: any) => {
        const risk = params.value;
        let badge = 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30';
        if (risk === 'MEDIUM') badge = 'bg-yellow-900/40 text-yellow-300 border-yellow-500/30';
        if (risk === 'HIGH') badge = 'bg-orange-900/40 text-orange-300 border-orange-500/30';
        if (risk === 'CRITICAL') badge = 'bg-red-900/50 text-red-300 border-red-500/40 animate-pulse';
        
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${badge}`}>
            {risk}
          </span>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 160,
      cellRenderer: (params: any) => {
        const status = params.value;
        let icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1" />;
        let textClass = 'text-emerald-400';
        
        if (status === 'REJECTED' || status === 'KILL_SWITCH_REVOKED') {
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
      headerName: 'Details',
      width: 110,
      cellRenderer: (params: any) => {
        if (!params.data?.httpPayloadLog) return null;
        return (
          <button
            onClick={() => setSelectedLog(params.data)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs px-2 py-1 rounded border border-cyan-500/30 transition-all"
          >
            <Eye className="w-3 h-3" />
            <span>View</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">
            Audit Ledger & Transaction Vault
          </h2>
        </div>
        <div className="text-xs text-slate-400">
          Total Records: <strong className="text-cyan-400 font-mono">{logs.length}</strong>
        </div>
      </div>

      {/* AG Grid Table Container */}
      <div className="ag-theme-quartz-dark w-full h-[410px] rounded-lg overflow-hidden border border-slate-800">
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
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Terminal className="w-5 h-5" />
                <h3 className="font-bold text-lg text-white">
                  Escrow Transaction Settlement Detail
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white font-bold px-2.5 py-1 rounded bg-slate-800"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div><strong>Action:</strong> {selectedLog.action}</div>
              <div><strong>Recipient:</strong> <span className="text-slate-200">{selectedLog.recipientEmail}</span></div>
              <div><strong>PayPal Settlement Ref:</strong> <span className="font-mono text-emerald-400">{selectedLog.payPalTransactionId || 'N/A'}</span></div>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto max-h-60">
              <pre>{selectedLog.httpPayloadLog}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
