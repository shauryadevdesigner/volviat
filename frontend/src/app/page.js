'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  MessageSquare, 
  Server as ServerIcon, 
  Hash, 
  LogOut, 
  AlertTriangle,
  FileText,
  Play,
  Pause,
  HelpCircle
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'create' | 'logs'
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [channels, setChannels] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('interval'); // 'cron' | 'interval'
  const [formCron, setFormCron] = useState('0 9 * * *');
  const [formInterval, setFormInterval] = useState(60);
  const [formChannelId, setFormChannelId] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [formError, setFormError] = useState('');

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch channels when selected server changes
  useEffect(() => {
    if (selectedServerId) {
      fetchChannels(selectedServerId);
    } else {
      setChannels([]);
    }
  }, [selectedServerId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const serverRes = await fetch(`${API_BASE}/servers`);
      const serverData = await serverRes.json();
      setServers(serverData);
      if (serverData.length > 0) {
        setSelectedServerId(serverData[0].guildId);
      }

      const scheduleRes = await fetch(`${API_BASE}/schedules`);
      const scheduleData = await scheduleRes.json();
      setSchedules(scheduleData);

      const logRes = await fetch(`${API_BASE}/logs`);
      const logData = await logRes.json();
      setAllLogs(logData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async (guildId) => {
    try {
      const res = await fetch(`${API_BASE}/channels/${guildId}`);
      const data = await res.json();
      setChannels(data);
      if (data.length > 0) {
        setFormChannelId(data[0].channelId);
      } else {
        setFormChannelId('');
      }
    } catch (error) {
      console.error(`Error fetching channels for guild ${guildId}:`, error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      await res.json();
      await fetchInitialData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Please provide a name for this schedule');
      return;
    }
    if (!formChannelId) {
      setFormError('Please select a target channel');
      return;
    }
    if (!formContent.trim()) {
      setFormError('Please write message content to broadcast');
      return;
    }

    const payload = {
      name: formName,
      type: formType,
      cronExpression: formType === 'cron' ? formCron : null,
      intervalMinutes: formType === 'interval' ? Number(formInterval) : null,
      guildId: selectedServerId,
      channelId: formChannelId,
      messageContent: formContent,
      status: formStatus
    };

    const url = editingId 
      ? `${API_BASE}/schedule/update` 
      : `${API_BASE}/schedule/create`;

    if (editingId) {
      payload.id = editingId;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Request failed');
      }

      resetForm();
      await fetchInitialData();
      setActiveTab('overview');
    } catch (error) {
      setFormError(error.message);
    }
  };

  const handleEdit = (schedule) => {
    setEditingId(schedule.id);
    setFormName(schedule.name);
    setFormType(schedule.type);
    if (schedule.type === 'cron') {
      setFormCron(schedule.cronExpression || '0 9 * * *');
    } else {
      setFormInterval(schedule.intervalMinutes || 60);
    }
    setSelectedServerId(schedule.guildId);
    setFormChannelId(schedule.channelId);
    setFormContent(schedule.messageContent);
    setFormStatus(schedule.status);
    setActiveTab('create');
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const res = await fetch(`${API_BASE}/schedule/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        await fetchInitialData();
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleToggleStatus = async (schedule) => {
    const nextStatus = schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await fetch(`${API_BASE}/schedule/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id,
          status: nextStatus
        })
      });

      if (res.ok) {
        await fetchInitialData();
      }
    } catch (error) {
      console.error('Toggle status failed:', error);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormType('interval');
    setFormCron('0 9 * * *');
    setFormInterval(60);
    setFormContent('');
    setFormStatus('ACTIVE');
    setFormError('');
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-[#18191c] px-1 py-0.5 rounded text-red-400 font-mono text-sm">$1</code>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-[#18191c] p-2.5 rounded my-1 font-mono text-sm whitespace-pre-wrap">$1</pre>');
    html = html.replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const totalSchedules = schedules.length;
  const activeCount = schedules.filter(s => s.status === 'ACTIVE').length;
  const successLogs = allLogs.filter(l => l.status === 'SUCCESS').length;
  const failedLogs = allLogs.filter(l => l.status === 'FAILED').length;
  const totalRuns = successLogs + failedLogs;
  const successRate = totalRuns > 0 ? Math.round((successLogs / totalRuns) * 100) : 100;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <header className="nav-glass px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#5865F2] p-2.5 rounded-xl text-white shadow-lg shadow-[#5865f2]/20 glow-text flex items-center justify-center">
            <Layers size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider leading-none">BROADCAST <span className="text-[#5865F2]">CONTROL</span></h1>
            <p className="text-[9px] text-gray-500 tracking-widest font-bold mt-1">DISCORD AUTOMATION ENGINE</p>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          <div className="nav-tabs-container flex items-center gap-1">
            <button 
              onClick={() => { setActiveTab('overview'); resetForm(); }}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all ${
                activeTab === 'overview' 
                  ? 'bg-[#5865F2] text-white shadow-md shadow-[#5865f2]/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button 
              onClick={() => { setActiveTab('create'); }}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'create' 
                  ? 'bg-[#5865F2] text-white shadow-md shadow-[#5865f2]/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Plus size={13} />
              {editingId ? 'Edit Job' : 'Create Broadcast'}
            </button>
            <button 
              onClick={() => { setActiveTab('logs'); }}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'logs' 
                  ? 'bg-[#5865F2] text-white shadow-md shadow-[#5865f2]/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText size={13} />
              Audit Logs
            </button>
          </div>
          <button 
            onClick={handleSync} 
            disabled={syncing}
            className="btn btn-secondary py-2 px-4 text-xs text-cyan-400 border-cyan-500/20 rounded-full font-bold"
            title="Sync Guilds and Channels from Bot Client"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span>Sync Client</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-6 md:p-10 max-w-6xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <RefreshCw size={36} className="animate-spin text-[#5865F2]" />
            <p className="text-gray-400 text-xs tracking-widest font-bold">LOADING BOT METRICS...</p>
          </div>
        ) : (
          <>
            {/* Overview & Statistics row */}
            {activeTab !== 'create' && (
              <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <div className="glass-panel metric-card metric-active p-6 flex items-center justify-between min-h-[100px]">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active Broadcasts</p>
                    <p className="text-3xl font-extrabold mt-2 text-white">{activeCount} <span className="text-xs text-gray-500 font-medium">/ {totalSchedules}</span></p>
                  </div>
                  <div className="bg-[#5865F2]/10 p-3 rounded-xl text-[#5865F2] flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                </div>

                <div className="glass-panel metric-card metric-servers p-6 flex items-center justify-between min-h-[100px]">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Connected Servers</p>
                    <p className="text-3xl font-extrabold mt-2 text-cyan-400">{servers.length}</p>
                  </div>
                  <div className="bg-cyan-500/10 p-3 rounded-xl text-cyan-400 flex items-center justify-center">
                    <ServerIcon size={20} />
                  </div>
                </div>

                <div className="glass-panel metric-card metric-success p-6 flex items-center justify-between min-h-[100px]">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Success Rate</p>
                    <p className="text-3xl font-extrabold mt-2 text-emerald-400">{successRate}%</p>
                  </div>
                  <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                </div>

                <div className="glass-panel metric-card metric-sent p-6 flex items-center justify-between min-h-[100px]">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Broadcasts Sent</p>
                    <p className="text-3xl font-extrabold mt-2 text-purple-400">{successLogs}</p>
                  </div>
                  <div className="bg-purple-500/10 p-3 rounded-xl text-purple-400 flex items-center justify-center">
                    <Play size={20} />
                  </div>
                </div>
              </section>
            )}

            {/* TAB: OVERVIEW / DASHBOARD */}
            {activeTab === 'overview' && (
              <div className="dashboard-grid">
                {/* Schedules Column */}
                <div className="flex flex-col gap-6">
                  <div className="glass-panel p-6 md:p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-lg font-bold tracking-tight">Scheduled Broadcast Jobs</h2>
                        <p className="text-xs text-gray-400 mt-1 font-medium">List of active and paused message schedules</p>
                      </div>
                      <button 
                        onClick={() => setActiveTab('create')} 
                        className="btn btn-primary py-2 px-4 text-xs font-bold rounded-full"
                      >
                        <Plus size={13} /> New Schedule
                      </button>
                    </div>

                    {schedules.length === 0 ? (
                      <div className="text-center py-20 border border-dashed border-white/5 rounded-xl">
                        <MessageSquare size={36} className="mx-auto text-gray-500 mb-4" />
                        <h3 className="text-sm font-semibold text-gray-300">No schedules configured</h3>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto font-medium">Create a schedule to automate message broadcasts to your Discord server channels.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-5">
                        {schedules.map((schedule) => {
                          const serverName = servers.find(s => s.guildId === schedule.guildId)?.name || 'Unknown Guild';
                          return (
                            <div key={schedule.id} className="glass-panel p-6 border-l-[3px] border-l-[#5865F2] hover:border-l-cyan-400 glass-panel-hover flex flex-col gap-4">
                              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      {schedule.status === 'ACTIVE' && <div className="glow-dot" />}
                                      <h3 className="font-extrabold text-white text-base tracking-tight">{schedule.name}</h3>
                                    </div>
                                    <span className={`badge ${schedule.status === 'ACTIVE' ? 'badge-active' : 'badge-paused'}`}>
                                      {schedule.status}
                                    </span>
                                  </div>
                                  
                                  {/* Info details */}
                                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3.5 text-xs font-medium text-gray-400">
                                    <span className="flex items-center gap-1.5 bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/[0.04]">
                                      <ServerIcon size={12} className="text-cyan-400" />
                                      {serverName}
                                    </span>
                                    <span className="flex items-center gap-1.5 bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/[0.04]">
                                      <Hash size={12} className="text-[#5865F2]" />
                                      Channel: {schedule.channelId}
                                    </span>
                                    <span className="flex items-center gap-1.5 font-mono text-purple-400 bg-purple-500/5 px-2.5 py-1.5 rounded-lg border border-purple-500/10">
                                      {schedule.type === 'cron' ? (
                                        <>
                                          <Calendar size={12} />
                                          Cron: {schedule.cronExpression}
                                        </>
                                      ) : (
                                        <>
                                          <Clock size={12} />
                                          Every {schedule.intervalMinutes} min
                                        </>
                                      )}
                                    </span>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                                  <button
                                    onClick={() => handleToggleStatus(schedule)}
                                    className={`btn-action ${schedule.status === 'ACTIVE' ? 'text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/30' : 'text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30'}`}
                                    title={schedule.status === 'ACTIVE' ? 'Pause broadcast' : 'Activate broadcast'}
                                  >
                                    {schedule.status === 'ACTIVE' ? <Pause size={13} /> : <Play size={13} />}
                                  </button>
                                  <button
                                    onClick={() => handleEdit(schedule)}
                                    className="btn-action text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/30"
                                    title="Edit schedule"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(schedule.id)}
                                    className="btn-action text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/30"
                                    title="Delete schedule"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Discord Preview embed-like box */}
                              <div className="bg-[#18191c] p-4 rounded-xl border border-white/[0.03] relative overflow-hidden flex gap-3.5 items-start">
                                <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#5865f2]" />
                                <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-[10px] font-extrabold shrink-0 shadow-md shadow-[#5865f2]/20 select-none">
                                  Bot
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-white font-bold text-xs hover:underline cursor-pointer">Broadcast Bot</span>
                                    <span className="bg-[#5865F2] text-[8px] text-white font-extrabold px-1 rounded uppercase tracking-wider scale-90">APP</span>
                                    <span className="text-gray-500 text-[10px] font-semibold">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className="text-gray-300 text-xs mt-2 break-words leading-relaxed font-medium">
                                    {schedule.messageContent}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Quick Audits Column */}
                <div className="flex flex-col gap-6">
                  <div className="glass-panel p-6">
                    <h2 className="text-base font-bold mb-5 flex items-center justify-between tracking-tight">
                      Recent Activity
                      <span className="text-xs text-gray-500 font-medium">Last 5 logs</span>
                    </h2>
                    
                    {allLogs.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 text-xs">
                        No broadcast executions logged yet.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {allLogs.slice(0, 5).map((log) => (
                          <div key={log.id} className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4 text-xs flex flex-col gap-1.5 hover:bg-white/[0.02] transition-all">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white truncate max-w-[130px]" title={log.schedule?.name || 'Unknown'}>
                                {log.schedule?.name || 'Deleted Job'}
                              </span>
                              <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-failed'} py-0.5 px-2 text-[9px] font-bold`}>
                                {log.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-semibold">
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                            {log.error && (
                              <p className="text-rose-400 font-mono text-[9px] mt-1 bg-rose-500/5 p-2 rounded border border-rose-500/10 overflow-x-auto">
                                Error: {log.error}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <button 
                      onClick={() => setActiveTab('logs')}
                      className="btn btn-secondary w-full text-xs mt-4 py-2.5 font-bold rounded-full"
                    >
                      View All Audit Logs
                    </button>
                  </div>

                  <div className="glass-panel p-6 bg-[#5865F2]/5 border-l-2 border-l-[#5865F2]">
                    <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                      <HelpCircle size={14} className="text-[#5865F2]" /> How it works
                    </h3>
                    <p className="text-xs text-gray-400 mt-3 leading-relaxed font-medium">
                      1. Connect your Discord Bot application to your server(s).<br/><br/>
                      2. Hit <strong className="text-cyan-400 font-bold">Sync Client</strong> to fetch text channels.<br/><br/>
                      3. Create a schedule specifying your target channel and broadcast timing (interval in minutes or cron).<br/><br/>
                      4. The scheduler engine automatically delivers your markdown message to Discord and writes logs.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CREATE OR EDIT SCHEDULE */}
            {activeTab === 'create' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form configuration column */}
                <div className="glass-panel p-6 md:p-8">
                  <h2 className="text-xl font-bold mb-1">{editingId ? 'Edit Schedule Job' : 'Create Broadcast Job'}</h2>
                  <p className="text-xs text-gray-400 mb-6">Configure the bot broadcast schedule and target channels</p>

                  {formError && (
                    <div className="mb-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3.5 rounded-lg flex items-start gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Error:</strong> {formError}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleCreateOrUpdate} className="flex flex-col gap-5">
                    <div>
                      <label className="form-label">Broadcast Name</label>
                      <input 
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., General Announcement, Morning Ping"
                        className="form-input w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Discord Guild (Server)</label>
                        <select 
                          value={selectedServerId}
                          onChange={(e) => setSelectedServerId(e.target.value)}
                          className="form-input w-full bg-[#12101e]"
                        >
                          {servers.length === 0 ? (
                            <option value="">No Servers Connected</option>
                          ) : (
                            servers.map(s => (
                              <option key={s.guildId} value={s.guildId}>{s.name}</option>
                            ))
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Target Text Channel</label>
                        <select 
                          value={formChannelId}
                          onChange={(e) => setFormChannelId(e.target.value)}
                          className="form-input w-full bg-[#12101e]"
                        >
                          {channels.length === 0 ? (
                            <option value="">No text channels found</option>
                          ) : (
                            channels.map(c => (
                              <option key={c.channelId} value={c.channelId}>#{c.name}</option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-white/[0.01] p-4 rounded-xl border border-white/5">
                      <div>
                        <label className="form-label">Schedule Mode</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFormType('interval')}
                            className={`btn flex-1 text-xs py-2 ${formType === 'interval' ? 'btn-primary' : 'btn-secondary'}`}
                          >
                            Interval
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormType('cron')}
                            className={`btn flex-1 text-xs py-2 ${formType === 'cron' ? 'btn-primary' : 'btn-secondary'}`}
                          >
                            Cron
                          </button>
                        </div>
                      </div>

                      <div>
                        {formType === 'interval' ? (
                          <>
                            <label className="form-label">Repeat Interval (Minutes)</label>
                            <input 
                              type="number"
                              min="1"
                              value={formInterval}
                              onChange={(e) => setFormInterval(e.target.value)}
                              className="form-input w-full"
                            />
                          </>
                        ) : (
                          <>
                            <label className="form-label">Cron Expression</label>
                            <input 
                              type="text"
                              value={formCron}
                              onChange={(e) => setFormCron(e.target.value)}
                              placeholder="* * * * *"
                              className="form-input w-full font-mono text-xs"
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {formType === 'cron' && (
                      <div className="text-[11px] text-gray-400 bg-black/20 p-3 rounded-lg border border-white/5 leading-relaxed">
                        💡 <strong>Common Cron Examples:</strong><br/>
                        • <span className="font-mono text-purple-400">0 9 * * *</span> — Daily at 9:00 AM UTC<br/>
                        • <span className="font-mono text-purple-400">0 */2 * * *</span> — Every 2 hours<br/>
                        • <span className="font-mono text-purple-400">0 12 * * 1-5</span> — Mon to Fri at 12:00 PM
                      </div>
                    )}

                    <div>
                      <label className="form-label">Message Content (Markdown Supported)</label>
                      <textarea
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        placeholder="Write a message to broadcast... **bold**, *italics*, `code` blocks are supported."
                        rows="7"
                        className="form-input w-full font-sans resize-y text-sm leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="form-label">Initial State</label>
                      <select 
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                        className="form-input w-2/5 bg-[#12101e]"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PAUSED">PAUSED</option>
                      </select>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button 
                        type="submit" 
                        className="btn btn-primary flex-1 py-3"
                      >
                        {editingId ? 'Save Configuration' : 'Create Broadcast Job'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { resetForm(); setActiveTab('overview'); }}
                        className="btn btn-secondary py-3 px-6"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>

                {/* Message preview column */}
                <div className="flex flex-col gap-6">
                  <div className="glass-panel p-6 md:p-8 flex-grow flex flex-col min-h-[400px]">
                    <h3 className="font-extrabold text-sm text-white mb-1 uppercase tracking-wider">Discord Channel Preview</h3>
                    <p className="text-[11px] text-gray-500 mb-4 font-semibold">Mock display of how this message will render in Discord</p>
                    
                    <div className="bg-[#18191c] border border-white/[0.03] rounded-xl flex-grow p-5 flex flex-col gap-3 min-h-[300px] relative overflow-hidden">
                      <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#5865f2]" />
                      {/* Discord post mock */}
                      <div className="flex gap-4 items-start pl-1">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-[10px] font-extrabold shrink-0 shadow-[#5865f2]/20 shadow-md select-none">
                          Bot
                        </div>
                        {/* Message body */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white font-bold text-xs hover:underline cursor-pointer">Broadcast Bot</span>
                            <span className="bg-[#5865F2] text-[8px] text-white font-extrabold px-1 rounded uppercase tracking-wider scale-90">APP</span>
                            <span className="text-gray-500 text-[10px] font-semibold">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          {/* Markdown rendering output */}
                          <div className="text-gray-300 text-xs mt-2 break-words leading-relaxed font-medium">
                            {formContent ? (
                              renderMarkdown(formContent)
                            ) : (
                              <span className="text-gray-500 italic">Write something in the message editor to see it previewed here...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: AUDIT LOGS */}
            {activeTab === 'logs' && (
              <div className="glass-panel p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Execution Audit Logs</h2>
                    <p className="text-xs text-gray-400 mt-1 font-medium">Comprehensive audit trail of sent and failed broadcast triggers</p>
                  </div>
                  <button 
                    onClick={fetchInitialData}
                    className="btn btn-secondary py-2 px-4 text-xs font-bold rounded-full"
                  >
                    <RefreshCw size={12} /> Reload Logs
                  </button>
                </div>

                {allLogs.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    No logs found in database.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                          <th className="pb-4 pl-3">Timestamp</th>
                          <th className="pb-4">Broadcast Job</th>
                          <th className="pb-4">Deliver Status</th>
                          <th className="pb-4">Target Channel</th>
                          <th className="pb-4 pr-3">Details / Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allLogs.map((log) => (
                          <tr key={log.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                            <td className="py-4 pl-3 text-xs text-gray-400 whitespace-nowrap font-semibold">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-4 font-bold text-white">
                              {log.schedule?.name || <span className="text-gray-500 italic">Deleted Job</span>}
                            </td>
                            <td className="py-4">
                              <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-failed'} py-0.5 px-2 text-[9px] font-bold`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="py-4 text-xs font-mono text-purple-300">
                              {log.schedule?.channelId ? `#${log.schedule.channelId}` : 'N/A'}
                            </td>
                            <td className="py-4 pr-3 text-xs font-mono max-w-sm overflow-hidden text-ellipsis">
                              {log.status === 'SUCCESS' ? (
                                <span className="text-emerald-400 flex items-center gap-1.5 font-semibold"><CheckCircle2 size={13} /> Broadcast delivered</span>
                              ) : (
                                <span className="text-rose-400 flex items-start gap-1.5 font-semibold"><XCircle size={13} className="shrink-0 mt-0.5" /> {log.error || 'Connection Failed'}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.03] bg-[#05050b]/20 text-center py-6 text-xs text-gray-500 mt-12">
        <p className="font-semibold">© {new Date().getFullYear()} Discord Broadcast Bot Control Centre. Designed with Premium Glassmorphism.</p>
      </footer>
    </div>
  );
}
