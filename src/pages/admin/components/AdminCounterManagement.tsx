import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminManageCounters from './AdminManageCounters';
import AdminManageAuditors from './AdminManageAuditors';
import AdminManageTeamLeads from './AdminManageTeamLeads';

interface AdminCounterManagementProps {
  counters: any[];
  auditors: any[];
  teamLeads: any[];
  loading: boolean;
  onAddCounterClick: () => void;
  onEditCounterClick: (id: number, currentUsername: string) => void;
  onDeleteCounterClick: (id: number) => void;
  onAddAuditorClick: () => void;
  onEditAuditorClick: (id: number, currentUsername: string) => void;
  onDeleteAuditorClick: (id: number) => void;
  onAddTeamLeadClick: () => void;
  onEditTeamLeadClick: (id: number, currentUsername: string) => void;
  onDeleteTeamLeadClick: (id: number) => void;
}

export default function AdminCounterManagement(props: AdminCounterManagementProps) {
  const [activeTab, setActiveTab] = useState<'counters' | 'auditors' | 'team_leads'>('counters');

  return (
    <div className="space-y-6">
      {/* Inner Navigation Tabs */}
      <div className="flex gap-4 p-1 bg-[#111111] border border-[#222222] rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('counters')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'counters'
              ? 'bg-purple-600/20 text-purple-400'
              : 'text-text-secondary hover:text-white hover:bg-[#222222]'
          }`}
        >
          Manage Counters
        </button>
        <button
          onClick={() => setActiveTab('auditors')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'auditors'
              ? 'bg-emerald-600/20 text-emerald-400'
              : 'text-text-secondary hover:text-white hover:bg-[#222222]'
          }`}
        >
          Manage Auditors
        </button>
        <button
          onClick={() => setActiveTab('team_leads')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'team_leads'
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-text-secondary hover:text-white hover:bg-[#222222]'
          }`}
        >
          Manage Team Leads
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'counters' && (
            <AdminManageCounters
              counters={props.counters}
              loading={props.loading}
              onAddClick={props.onAddCounterClick}
              onEditClick={props.onEditCounterClick}
              onDeleteClick={props.onDeleteCounterClick}
            />
          )}

          {activeTab === 'auditors' && (
            <AdminManageAuditors
              auditors={props.auditors}
              loading={props.loading}
              onAddClick={props.onAddAuditorClick}
              onEditClick={props.onEditAuditorClick}
              onDeleteClick={props.onDeleteAuditorClick}
            />
          )}

          {activeTab === 'team_leads' && (
            <AdminManageTeamLeads
              teamLeads={props.teamLeads}
              loading={props.loading}
              onAddClick={props.onAddTeamLeadClick}
              onEditClick={props.onEditTeamLeadClick}
              onDeleteClick={props.onDeleteTeamLeadClick}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
