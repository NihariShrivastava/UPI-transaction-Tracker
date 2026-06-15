import { useState, useEffect, useMemo } from 'react';
import { LogOut, LayoutDashboard, FileSpreadsheet, Users, Activity, CheckCircle, RefreshCw, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { supabase } from '../../lib/supabase';
import AdminReportsTab from '../admin/components/AdminReportsTab';
import { ReportGroupDetailsModal, DuplicateDetailsModal } from '../admin/components/AdminModals';

interface TeamLeadDashboardProps {
  username: string;
  onLogout: () => void;
}

export default function TeamLeadDashboard({ username, onLogout }: TeamLeadDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('dashboard');
  const [showCountersModal, setShowCountersModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = ['Missing in PhonePe but available in Excellon', 'Missing in Excellon but available in PhonePe', 'Duplicate Entries', 'Mismatched Amount', 'Pending Approvals'];

  const [loading, setLoading] = useState(true);
  const [teamLeadData, setTeamLeadData] = useState<any>(null);
  
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportCounterGroup, setSelectedReportCounterGroup] = useState<{ counterId: number | null, username: string, totalAmount: number, reports: any[] } | null>(null);
  const [selectedDuplicateReport, setSelectedDuplicateReport] = useState<any | null>(null);
  const [reportsFilterDate, setReportsFilterDate] = useState<string>('');

  const [metrics, setMetrics] = useState({
    totalDiscrepancies: 0,
    totalUploads: 0,
    assignedCounters: 0
  });

  // 1. Fetch Team Lead Data & Metrics
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        setLoading(true);
        // Get Team Lead info
        const { data: tlData, error: tlErr } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (tlErr || !tlData) throw new Error('Could not load team lead data');
        setTeamLeadData(tlData);

        const counters = tlData.assigned_counters || [];
        setMetrics(prev => ({ ...prev, assignedCounters: counters.length }));

        // Get total uploads from these counters
        if (counters.length > 0) {
          const { count: txCount } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('source', 'counter')
            .in('counter_name', counters); // Warning: users table uses 'username' for array, transactions might use 'counter_name' or we join
            // Actually transactions has counter_id. Let's get the IDs first.
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitData();
  }, [username]);

  // We need the Counter IDs to filter reports and transactions.
  const [assignedCounterIds, setAssignedCounterIds] = useState<number[]>([]);

  useEffect(() => {
    if (teamLeadData?.assigned_counters?.length > 0) {
      const getIds = async () => {
        const { data } = await supabase
          .from('users')
          .select('id, username')
          .in('username', teamLeadData.assigned_counters);
        
        if (data) {
          setAssignedCounterIds(data.map(u => u.id));
          
          // Now fetch uploads
          const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('source', 'counter')
            .in('counter_id', data.map(u => u.id));
          
          if (count !== null) setMetrics(prev => ({ ...prev, totalUploads: count }));
        }
      };
      getIds();
    }
  }, [teamLeadData]);

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
        
        // Update global discrepancy count for this team lead
        if (currentSlide !== 4) {
           const { count } = await supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .in('counter_id', assignedCounterIds);
            
           // Can't easily filter jsonb via count without raw sql if we want to exclude status. So let's just do it client side or keep a rough metric.
           // setMetrics(prev => ({ ...prev, totalDiscrepancies: count || 0 }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReportsLoading(false);
    }
  };

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

  useEffect(() => {
    fetchReports();
  }, [currentSlide, reportsFilterDate, assignedCounterIds]);

  // 3. Actions
  const handleResolveReport = async (reportId: number) => {
    if (!window.confirm("Do you want to propose resolving this discrepancy? It will be sent to the Auditor for approval.")) {
      return;
    }
    try {
      const { data: originalReport } = await supabase.from('reports').select('*').eq('id', reportId).single();
      const updatedDetails = { 
        ...(originalReport?.details || {}), 
        approval_status: 'pending_resolve',
        acted_by: teamLeadData?.id,
        acted_at: new Date().toISOString()
      };

      const { error } = await supabase.from('reports').update({ details: updatedDetails }).eq('id', reportId);
      if (error) throw error;
      fetchReports();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditReport = async (reportId: number, newUpiId: string, newAmount: number) => {
    try {
      const { data: originalReport } = await supabase.from('reports').select('*').eq('id', reportId).single();
      const updatedDetails = { 
        ...(originalReport?.details || {}), 
        approval_status: 'pending_edit',
        proposed_edit: { upi_id: newUpiId, amount: newAmount },
        acted_by: teamLeadData?.id,
        acted_at: new Date().toISOString()
      };

      const { error } = await supabase.from('reports').update({ details: updatedDetails }).eq('id', reportId);
      if (error) throw error;
      
      setSelectedReportCounterGroup(null);
      fetchReports();
    } catch (err) {
      console.error(err);
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

  const handleMatchReport = async (reportId: number): Promise<boolean> => {
    // For Match, we just mark it as matched and send to auditor as pending check
    try {
      const { data: originalReport } = await supabase.from('reports').select('*').eq('id', reportId).single();
      const updatedDetails = { 
        ...(originalReport?.details || {}), 
        status: 'matched', // it's matched immediately 
        approval_status: 'pending_match_check', // auditor needs to check
        acted_by: teamLeadData?.id,
        acted_at: new Date().toISOString()
      };

      const { error } = await supabase.from('reports').update({ details: updatedDetails }).eq('id', reportId);
      if (error) throw error;
      fetchReports();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleMatchAllReports = async (): Promise<{ allMatched: boolean, remainingCount: number }> => {
     // Match all functionality skipped for simplicity in TL dashboard or implement similarly
     return { allMatched: false, remainingCount: 0 };
  };

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary overflow-x-hidden selection:bg-purple-500/30 selection:text-white flex flex-col font-sans relative">
      <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-xl border-b border-[#222222] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo />
            <div className="h-6 w-[1px] bg-[#333333] hidden md:block"></div>
            <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-text-secondary">
              Welcome back to your workspace
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-white leading-tight">Team Lead</div>
              <div className="text-xs text-purple-400 font-mono font-bold">{username}</div>
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
            <div className="relative bg-gradient-to-r from-purple-900/40 via-[#111111] to-[#111111] border border-[#222222] p-8 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2 tracking-tight">
                    Hello, <span className="text-purple-400">{username}</span> 👋
                  </h2>
                  <p className="text-text-secondary max-w-lg leading-relaxed">
                    Here's a summary of your assigned team's performance today. You currently have <span className="text-purple-300 font-bold">{metrics.assignedCounters}</span> active counters to monitor. Keep up the great work!
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card 
                className="bg-[#111111]/80 backdrop-blur-xl border-[#222222] hover:border-purple-500/50 transition-all duration-300 cursor-pointer"
                onClick={() => setShowCountersModal(true)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                      <Users className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary font-medium">Assigned Counters</p>
                      <h3 className="text-3xl font-bold text-white font-mono mt-1">{metrics.assignedCounters}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111111]/80 backdrop-blur-xl border-[#222222] hover:border-fuchsia-500/50 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-500/30">
                      <Activity className="w-6 h-6 text-fuchsia-400" />
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary font-medium">Total Uploads</p>
                      <h3 className="text-3xl font-bold text-white font-mono mt-1">{metrics.totalUploads}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="group bg-[#111111]/80 backdrop-blur-xl border-[#222222] hover:border-blue-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-center"
                onClick={() => setActiveTab('reports')}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary font-medium uppercase tracking-wider">Supervision</p>
                      <h3 className="text-2xl font-bold text-white mt-1 flex items-center gap-2 group-hover:text-blue-300 transition-colors">
                        View Reports <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                      </h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {showCountersModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCountersModal(false)} />
                <div className="relative bg-[#111111] border border-[#222222] rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">Your Assigned Counters</h3>
                    <button onClick={() => setShowCountersModal(false)} className="text-text-secondary hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {teamLeadData?.assigned_counters?.map((c: string) => (
                      <span key={c} className="px-3 py-1 bg-[#222222] rounded-md text-sm text-purple-300 border border-[#333333]">{c}</span>
                    ))}
                    {(!teamLeadData?.assigned_counters || teamLeadData.assigned_counters.length === 0) && (
                      <span className="text-text-secondary">No counters assigned.</span>
                    )}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button variant="ghost" onClick={() => setShowCountersModal(false)}>Close</Button>
                  </div>
                </div>
              </div>
            )}
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
              nextSlide={() => setCurrentSlide(c => (c + 1) % slides.length)}
              prevSlide={() => setCurrentSlide(c => (c - 1 + slides.length) % slides.length)}
              reportsData={reportsData}
              reportsLoading={reportsLoading}
              reportsFilterDate={reportsFilterDate}
              setReportsFilterDate={setReportsFilterDate}
              groupedReportsByCounter={groupedReportsByCounter}
              onOpenGroupDetails={(group) => setSelectedReportCounterGroup(group)}
              onEditReport={handleEditReport}
              onAddRemark={handleAddRemark}
              onMatchReport={handleMatchReport}
              onResolveReport={handleResolveReport}
              onOpenDuplicateDetails={(report) => setSelectedDuplicateReport(report)}
              role="team_lead"
            />
          </div>
        )}
      </main>

      {selectedReportCounterGroup && (
        <ReportGroupDetailsModal
          group={selectedReportCounterGroup}
          onClose={() => setSelectedReportCounterGroup(null)}
          reportsFilterDate={reportsFilterDate}
          onEditReport={handleEditReport}
          onMatchReport={handleMatchReport}
          onResolveReport={handleResolveReport}
          onAddRemark={handleAddRemark}
          role="team_lead"
        />
      )}

      {selectedDuplicateReport && (
        <DuplicateDetailsModal
          report={selectedDuplicateReport}
          onClose={() => setSelectedDuplicateReport(null)}
          onResolveReport={handleResolveReport}
          onAddRemark={handleAddRemark}
          role="team_lead"
        />
      )}
    </div>
  );
}
