import { useState, useEffect, useMemo } from 'react';
import { LogOut, Activity, CheckSquare, ShieldCheck, ArrowLeft, ArrowRight, Calendar, X, ChevronRight, Users } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { supabase } from '../../lib/supabase';
import AdminReportsTab from '../admin/components/AdminReportsTab';
import { ReportGroupDetailsModal, DuplicateDetailsModal } from '../admin/components/AdminModals';

interface AuditorDashboardProps {
  username: string;
  onLogout: () => void;
}

export default function AuditorDashboard({ username, onLogout }: AuditorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('dashboard');
  const [currentSlide, setCurrentSlide] = useState(4);
  const slides = ['Missing in PhonePe but available in Excellon', 'Missing in Excellon but available in PhonePe', 'Duplicate Entries', 'Mismatched Amount', 'Pending Approvals', 'Team Lead Performance'];


  const [teamLeadsData, setTeamLeadsData] = useState<any[]>([]);
  
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportCounterGroup, setSelectedReportCounterGroup] = useState<{ counterId: number | null, username: string, totalAmount: number, reports: any[] } | null>(null);
  const [selectedDuplicateReport, setSelectedDuplicateReport] = useState<any | null>(null);
  const [reportsFilterDate, setReportsFilterDate] = useState<string>('');

  const [metrics, setMetrics] = useState({
    workDoneToday: 0,
    pendingApprovals: 0,
    teamLeadNames: 'None',
    teamLeadIds: [] as number[]
  });

  const [assignedCounterIds, setAssignedCounterIds] = useState<number[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [selectedPerformanceDate, setSelectedPerformanceDate] = useState<string | null>(null);

  const [showTeamLeadsModal, setShowTeamLeadsModal] = useState(false);
  const [activeTeamLeadSlide, setActiveTeamLeadSlide] = useState(0);

  // 1. Fetch Auditor Data & Team Lead Data
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        // Get Auditor info
        const { data: aData, error: aErr } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (aErr || !aData) throw new Error('Could not load auditor data');


        if (aData.assigned_team_leads && aData.assigned_team_leads.length > 0) {
          // Fetch assigned Team Leads by username
          const { data: tlDataArray } = await supabase
            .from('users')
            .select('*')
            .in('username', aData.assigned_team_leads);

          if (tlDataArray && tlDataArray.length > 0) {
            setTeamLeadsData(tlDataArray);
            setMetrics(prev => ({ 
              ...prev, 
              teamLeadNames: tlDataArray.map(tl => tl.username).join(', '),
              teamLeadIds: tlDataArray.map(tl => tl.id)
            }));
            
            // Fetch Counters assigned to all these Team Leads
            let allAssignedCounters: string[] = [];
            tlDataArray.forEach(tl => {
              if (tl.assigned_counters && tl.assigned_counters.length > 0) {
                allAssignedCounters = [...allAssignedCounters, ...tl.assigned_counters];
              }
            });
            
            // Deduplicate counters
            allAssignedCounters = Array.from(new Set(allAssignedCounters));

            if (allAssignedCounters.length > 0) {
              const { data: cData } = await supabase
                .from('users')
                .select('id')
                .in('username', allAssignedCounters);
              
              if (cData) {
                setAssignedCounterIds(cData.map(c => c.id));
              }
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitData();
  }, [username]);

  // 2. Fetch Reports for the current slide
  const fetchReports = async () => {
    if (assignedCounterIds.length === 0 && currentSlide !== 4) {
      setReportsData([]);
      return;
    }
    
    try {
      setReportsLoading(true);
      
      let query = supabase.from('reports').select('*, users(counter_name, username)');
      
      if (currentSlide === 4) {
        // Pending Approvals bucket
        // We show all reports that have a pending approval status for THIS team lead's counters
        query = query.in('counter_id', assignedCounterIds).not('details->approval_status', 'is', null);
      } else {
        const reportType = currentSlide === 0 ? 'missing_in_admin' : currentSlide === 1 ? 'missing_in_counter' : currentSlide === 2 ? 'duplicate_upi' : 'mismatched_amount';
        query = query.eq('type', reportType).in('counter_id', assignedCounterIds);
      }

      if (reportsFilterDate) {
        query = query.eq('date', reportsFilterDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching reports:', error);
      } else {
        // Filter out resolved ones if not in pending approvals
        let activeReports = data || [];
        if (currentSlide !== 4) {
          activeReports = activeReports.filter((r: any) => !r.details?.status && !r.details?.approval_status);
        }
        setReportsData(activeReports);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [currentSlide, reportsFilterDate, assignedCounterIds]);

  useEffect(() => {
    if (assignedCounterIds.length === 0 || teamLeadsData.length === 0) return;
    
    const fetchMetrics = async () => {
      // Work Done Today = Reports that have status = 'resolved' or 'matched', or approval_status set, 
      // acted_at >= start of today, and acted_by = teamLeadData.id
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const { data } = await supabase
        .from('reports')
        .select('details')
        .in('counter_id', assignedCounterIds);

      if (data) {
        let workDoneCount = 0;
        let pendingCount = 0;

        data.forEach(r => {
          if (r.details?.approval_status) {
            pendingCount++;
          }
          if (r.details?.acted_by && metrics.teamLeadIds.includes(r.details.acted_by) && r.details?.acted_at >= todayStr) {
            workDoneCount++;
          }
        });

        setMetrics(prev => ({
          ...prev,
          workDoneToday: workDoneCount,
          pendingApprovals: pendingCount
        }));
      }
    };
    fetchMetrics();
  }, [assignedCounterIds, teamLeadsData, reportsData, metrics.teamLeadIds]); // Refresh metrics when reports change

  // Fetch Analytics for Performance Slide
  useEffect(() => {
    if (currentSlide !== 5 || assignedCounterIds.length === 0 || teamLeadsData.length === 0) return;
    
    const fetchAnalytics = async () => {
      try {
        setPerformanceLoading(true);
        // We fetch all reports for these counters that have some TL action
        const { data, error } = await supabase
          .from('reports')
          .select('*, users(counter_name, username)')
          .in('counter_id', assignedCounterIds);
          
        if (error) throw error;
        
        const analytics = data?.filter(r => 
          (r.details?.acted_by && metrics.teamLeadIds.includes(r.details.acted_by)) || 
          r.details?.rejection_count > 0 || 
          r.details?.status === 'resolved' || 
          r.details?.status === 'matched'
        ) || [];
        
        setPerformanceData(analytics);
      } catch (err) {
        console.error(err);
      } finally {
        setPerformanceLoading(false);
      }
    };
    fetchAnalytics();
  }, [currentSlide, assignedCounterIds, teamLeadsData, metrics.teamLeadIds]);

  const groupedReportsByCounter = useMemo(() => {
    if (currentSlide !== 0 && currentSlide !== 3 && currentSlide !== 4) return [];
    
    const groups: { [key: string]: { counterId: number | null; username: string; counterName: string; reports: any[]; totalAmount: number } } = {};
    
    reportsData.forEach(r => {
      const cId = r.counter_id;
      const username = r.users?.username || `Counter ${cId || 'Unknown'}`;
      const key = cId ? String(cId) : 'unknown';
      
      if (!groups[key]) {
        groups[key] = {
          counterId: cId,
          username,
          counterName: r.users?.counter_name || '',
          reports: [],
          totalAmount: 0
        };
      }
      
      groups[key].reports.push(r);
      groups[key].totalAmount += Number(r.amount);
    });
    
    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [reportsData, currentSlide]);


  const performanceByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    performanceData.forEach(r => {
      const actedAt = r.details?.acted_at;
      if (actedAt) {
        const d = actedAt.split('T')[0];
        if (!groups[d]) groups[d] = [];
        groups[d].push(r);
      }
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [performanceData]);

  const renderPerformanceSlide = () => {
    const totalEntries = performanceData.length;
    const pendingCount = performanceData.filter(r => r.details?.approval_status).length;
    const failedCount = performanceData.reduce((acc, r) => acc + (r.details?.rejection_count || 0), 0);
    
    return (
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 shadow-2xl min-h-[400px]">
        <h3 className="text-xl font-bold text-white mb-6">Team Lead Working Overview</h3>
        
        {performanceLoading ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#151515] border border-[#222222] p-4 rounded-xl flex justify-between items-center">
                <span className="text-text-secondary text-sm font-medium">Total Actions Taken</span>
                <span className="text-2xl font-mono font-bold text-white">{totalEntries}</span>
              </div>
              <div className="bg-[#151515] border border-amber-500/20 p-4 rounded-xl flex justify-between items-center">
                <span className="text-amber-400 text-sm font-medium">Pending Approvals</span>
                <span className="text-2xl font-mono font-bold text-amber-400">{pendingCount}</span>
              </div>
              <div className="bg-[#151515] border border-red-500/20 p-4 rounded-xl flex justify-between items-center">
                <span className="text-red-400 text-sm font-medium">Failed Approvals</span>
                <span className="text-2xl font-mono font-bold text-red-400">{failedCount}</span>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-4">Work Done Date-Wise</h4>
              {performanceByDate.length === 0 ? (
                <p className="text-text-secondary">No recorded actions found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {performanceByDate.map(([date, reports]) => (
                    <div 
                      key={date} 
                      onClick={() => setSelectedPerformanceDate(date)}
                      className="bg-gradient-to-br from-[#161616] to-[#0d0d0d] border border-[#222222] hover:border-cyan-500/50 p-4 rounded-xl cursor-pointer transition-colors group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-white font-bold">{new Date(date).toLocaleDateString()}</p>
                          <p className="text-xs text-text-secondary">{reports.length} Discrepancies Solved</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#333333] group-hover:text-cyan-400 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Auditor Actions
  const handleApproveReport = async (reportId: number) => {
    try {
      const { data: originalReport } = await supabase.from('reports').select('*').eq('id', reportId).single();
      if (!originalReport) return;

      const details = originalReport.details || {};
      const approvalStatus = details.approval_status;
      
      let updatePayload: any = {
        details: { 
          ...details,
          auditor_acted_at: new Date().toISOString(),
          auditor_action: 'approved',
          auditor_id: username
        }
      };
      
      // Clear approval flags
      delete updatePayload.details.approval_status;

      if (approvalStatus === 'pending_resolve') {
        updatePayload.details.status = 'resolved';
      } else if (approvalStatus === 'pending_edit' && details.proposed_edit) {
        updatePayload.upi_id = details.proposed_edit.upi_id;
        updatePayload.amount = details.proposed_edit.amount;
        updatePayload.details.is_edited = true;
        delete updatePayload.details.proposed_edit;
      } else if (approvalStatus === 'pending_match_check') {
        updatePayload.details.status = 'matched';
      }

      const { error } = await supabase.from('reports').update(updatePayload).eq('id', reportId);
      if (error) throw error;
      fetchReports();
    } catch (err) {
      console.error("Error approving report", err);
    }
  };

  const handleRejectReport = async (reportId: number) => {
    try {
      const { data: originalReport } = await supabase.from('reports').select('*').eq('id', reportId).single();
      if (!originalReport) return;

      const details = { 
        ...originalReport.details,
        rejection_count: (originalReport.details?.rejection_count || 0) + 1,
        auditor_acted_at: new Date().toISOString(),
        auditor_action: 'rejected',
        auditor_id: username
      };
      delete details.approval_status;
      delete details.proposed_edit;

      const { error } = await supabase.from('reports').update({ details }).eq('id', reportId);
      if (error) throw error;
      fetchReports();
    } catch (err) {
      console.error("Error rejecting report", err);
    }
  };

  const handleAddRemark = async (reportId: number, remark: string) => {
    try {
      const { data: originalReport } = await supabase.from('reports').select('*').eq('id', reportId).single();
      const updatedDetails = { ...(originalReport?.details || {}), admin_remark: remark };
      const { error } = await supabase.from('reports').update({ details: updatedDetails }).eq('id', reportId);
      if (error) throw error;
      fetchReports();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary overflow-x-hidden selection:bg-cyan-500/30 selection:text-white flex flex-col font-sans relative">
      <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-xl border-b border-[#222222] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo />
            <div className="h-6 w-[1px] bg-[#333333] hidden md:block"></div>
            <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-text-secondary">
              Auditor Supervision Workspace
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-white leading-tight">Auditor</div>
              <div className="text-xs text-cyan-400 font-mono font-bold">{username}</div>
            </div>
            <Button variant="danger" size="sm" onClick={onLogout} className="flex items-center gap-2 font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 relative z-10">
        {activeTab === 'dashboard' ? (
          <div className="space-y-8 animate-fade-in">
            {/* Greeting Section */}
            <div className="relative bg-gradient-to-r from-cyan-900/40 via-[#111111] to-[#111111] border border-[#222222] p-8 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2 tracking-tight">
                    Hello, <span className="text-cyan-400">{username}</span> 👋
                  </h2>
                  <p className="text-text-secondary max-w-lg leading-relaxed">
                    Welcome to the Auditor workspace. You are currently overseeing Team Leads <span className="text-cyan-300 font-bold">{metrics.teamLeadNames}</span> across <span className="text-cyan-300 font-bold">{assignedCounterIds.length}</span> counters.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-[#111111]/80 backdrop-blur-xl border-[#222222] hover:border-cyan-500/50 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                      <CheckSquare className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary font-medium">Work Done Today</p>
                      <h3 className="text-3xl font-bold text-white font-mono mt-1">{metrics.workDoneToday}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="group bg-[#111111]/80 backdrop-blur-xl border-[#222222] hover:border-amber-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-center"
                onClick={() => {
                  setCurrentSlide(4);
                  setActiveTab('reports');
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition-transform">
                      <Activity className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary font-medium uppercase tracking-wider">Workspace</p>
                      <h3 className="text-2xl font-bold text-white mt-1 flex items-center gap-2 group-hover:text-amber-300 transition-colors">
                        Pending Approvals <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
                      </h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div 
              className="bg-[#111111] p-6 rounded-xl border border-[#222222] hover:border-cyan-500/50 cursor-pointer transition-all group"
              onClick={() => {
                setShowTeamLeadsModal(true);
                setActiveTeamLeadSlide(0);
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Assigned Team Leads
                </h3>
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  View Details <ArrowRight className="w-4 h-4" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="px-3 py-1 bg-cyan-500/10 rounded-md text-sm text-cyan-300 border border-cyan-500/20 font-bold">{metrics.teamLeadNames}</span>
                <span className="text-text-secondary text-sm">Managing {assignedCounterIds.length} Counters</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                onClick={() => setActiveTab('dashboard')} 
                className="text-text-secondary hover:text-white flex items-center gap-2 px-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </div>
            <AdminReportsTab
              currentSlide={currentSlide}
              slides={slides}
              hiddenSlides={[0, 1, 2, 3]}
              nextSlide={() => setCurrentSlide(c => {
                let next = (c + 1) % slides.length;
                if (next < 4) next = 4;
                return next;
              })}
              prevSlide={() => setCurrentSlide(c => {
                let prev = (c - 1 + slides.length) % slides.length;
                if (prev < 4) prev = 5;
                return prev;
              })}
              reportsData={reportsData}
              reportsLoading={reportsLoading}
              reportsFilterDate={reportsFilterDate}
              setReportsFilterDate={setReportsFilterDate}
              groupedReportsByCounter={groupedReportsByCounter}
              onOpenGroupDetails={(group) => setSelectedReportCounterGroup(group)}
              onAddRemark={handleAddRemark}
              onApproveReport={handleApproveReport}
              onRejectReport={handleRejectReport}
              onOpenDuplicateDetails={(report) => setSelectedDuplicateReport(report)}
              role="auditor"
              renderCustomSlide={(idx) => idx === 5 ? renderPerformanceSlide() : null}
              teamLeadsData={teamLeadsData}
            />
          </div>
        )}
      </main>

      {selectedReportCounterGroup && (
        <ReportGroupDetailsModal
          group={selectedReportCounterGroup}
          onClose={() => setSelectedReportCounterGroup(null)}
          onAddRemark={handleAddRemark}
          role="auditor"
        />
      )}

      {selectedDuplicateReport && (
        <DuplicateDetailsModal
          report={selectedDuplicateReport}
          onClose={() => setSelectedDuplicateReport(null)}
          onAddRemark={handleAddRemark}
          role="auditor"
        />
      )}

      {/* Performance Details Modal */}
      {selectedPerformanceDate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPerformanceDate(null)} />
          <div className="relative bg-[#111111] border border-[#222222] rounded-2xl w-full max-w-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#222222]">
              <div>
                <h3 className="text-xl font-bold text-white">Actions on {new Date(selectedPerformanceDate).toLocaleDateString()}</h3>
                <p className="text-sm text-text-secondary mt-1">{performanceByDate.find(g => g[0] === selectedPerformanceDate)?.[1].length || 0} tickets processed</p>
              </div>
              <button onClick={() => setSelectedPerformanceDate(null)} className="text-text-secondary hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto pr-2 space-y-3 flex-1">
              {performanceByDate.find(g => g[0] === selectedPerformanceDate)?.[1].map((report: any) => (
                <div key={report.id} className="bg-[#151515] border border-[#222222] p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-cyan-400 font-mono text-sm font-bold">{report.upi_id}</span>
                      <p className="text-xs text-text-secondary mt-0.5">Amount: ₹{report.amount}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      report.details?.approval_status ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      report.details?.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      report.details?.status === 'matched' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-[#222222] text-text-secondary border-[#333333]'
                    }`}>
                      {report.details?.approval_status ? 'Pending Approval' : report.details?.status?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary">
                    <p>Counter: {report.users?.counter_name || `ID: ${report.counter_id}`}</p>
                    {report.details?.rejection_count > 0 && (
                      <p className="text-red-400 mt-1">Rejected {report.details.rejection_count} times</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Team Leads Slider Modal */}
      {showTeamLeadsModal && teamLeadsData.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTeamLeadsModal(false)} />
          <div className="relative bg-[#111111] border border-[#222222] rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#222222]">
              <h3 className="text-xl font-bold text-white">Assigned Team Leads</h3>
              <button onClick={() => setShowTeamLeadsModal(false)} className="text-text-secondary hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Carousel Content */}
            <div className="p-6 relative">
              <div className="text-center mb-6">
                <h4 className="text-2xl font-black text-cyan-400 mb-1">{teamLeadsData[activeTeamLeadSlide].username}</h4>
                <p className="text-sm text-text-secondary">Team Lead</p>
              </div>

              <div className="bg-[#161616] border border-[#222222] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#111111] sticky top-0">
                    <tr className="border-b border-[#333333]">
                      <th className="py-2 px-4 text-text-secondary font-medium text-xs">#</th>
                      <th className="py-2 px-4 text-text-secondary font-medium text-xs">Assigned Counters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLeadsData[activeTeamLeadSlide].assigned_counters?.map((c: string, idx: number) => (
                      <tr key={c} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                        <td className="py-2.5 px-4 text-xs font-mono text-text-secondary w-12">{idx + 1}</td>
                        <td className="py-2.5 px-4 text-sm font-bold text-white">{c}</td>
                      </tr>
                    ))}
                    {(!teamLeadsData[activeTeamLeadSlide].assigned_counters || teamLeadsData[activeTeamLeadSlide].assigned_counters.length === 0) && (
                      <tr>
                        <td colSpan={2} className="py-6 text-center text-sm text-text-secondary">No counters assigned.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Slider Controls */}
              {teamLeadsData.length > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => setActiveTeamLeadSlide(prev => (prev - 1 + teamLeadsData.length) % teamLeadsData.length)}
                    className="w-10 h-10 p-0 rounded-xl bg-[#222222] hover:bg-[#333333]"
                  >
                    <ArrowLeft className="w-4 h-4 text-cyan-400" />
                  </Button>
                  <div className="flex gap-1.5">
                    {teamLeadsData.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${activeTeamLeadSlide === idx ? 'w-6 bg-cyan-400' : 'w-1.5 bg-[#333333]'}`}
                      />
                    ))}
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => setActiveTeamLeadSlide(prev => (prev + 1) % teamLeadsData.length)}
                    className="w-10 h-10 p-0 rounded-xl bg-[#222222] hover:bg-[#333333]"
                  >
                    <ArrowRight className="w-4 h-4 text-cyan-400" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-[#222222] bg-[#161616] flex justify-end">
              <Button variant="ghost" onClick={() => setShowTeamLeadsModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
