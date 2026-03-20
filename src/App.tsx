/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  BookOpen, 
  MessageSquare, 
  Copy, 
  X,
  AlertCircle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { QACategory, FeedbackChannel, FeedbackStatus, QAEntry, FeedbackEntry } from './types';

// --- Components ---

const Badge = ({ status }: { status: FeedbackStatus }) => {
  const styles = {
    [FeedbackStatus.PENDING]: 'bg-apple-red/10 text-apple-red border-apple-red/20',
    [FeedbackStatus.PROCESSING]: 'bg-apple-orange/10 text-apple-orange border-apple-orange/20',
    [FeedbackStatus.RESOLVED]: 'bg-apple-green/10 text-apple-green border-apple-green/20',
  };
  const labels = {
    [FeedbackStatus.PENDING]: '待解答',
    [FeedbackStatus.PROCESSING]: '处理中',
    [FeedbackStatus.RESOLVED]: '已解决',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

const CategoryBadge = ({ category }: { category: QACategory }) => {
  const colors: Record<string, string> = {
    [QACategory.PRE_SALES]: 'bg-apple-blue/10 text-apple-blue border-apple-blue/20',
    [QACategory.CORE_FEATURES]: 'bg-apple-indigo/10 text-apple-indigo border-apple-indigo/20',
    [QACategory.ART_CONTENT]: 'bg-apple-orange/10 text-apple-orange border-apple-orange/20',
    [QACategory.AFTER_SALES]: 'bg-apple-red/10 text-apple-red border-apple-red/20',
  };
  return (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider whitespace-nowrap ${colors[category] || 'bg-apple-gray-100 text-apple-gray-300'}`}>
      {category}
    </span>
  );
};

// --- Main App ---

import { MOCK_QA, MOCK_FEEDBACK } from './mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState<'qa' | 'feedback'>('qa');
  const [selectedCategory, setSelectedCategory] = useState<QACategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [qaList, setQaList] = useState<QAEntry[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [showNewFeedbackModal, setShowNewFeedbackModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState<FeedbackEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Data Fetching
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Check if Supabase is configured
      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!isSupabaseConfigured) {
        throw new Error('Supabase configuration missing');
      }

      const [qaRes, feedbackRes] = await Promise.all([
        supabase.from('qa').select('*'),
        supabase.from('feedback').select('*')
      ]);

      if (qaRes.error || feedbackRes.error) {
        throw new Error(qaRes.error?.message || feedbackRes.error?.message || 'Supabase error');
      }

      setQaList(qaRes.data || []);
      setFeedbackList(feedbackRes.data || []);
      setIsDemoMode(false);
      showToast('数据库连接成功');
    } catch (error: any) {
      console.warn('Supabase Error:', error.message);
      setQaList(MOCK_QA);
      setFeedbackList(MOCK_FEEDBACK);
      setIsDemoMode(true);
      
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        showToast('数据库表不存在，请先创建表');
      } else if (error.message.includes('configuration missing')) {
        showToast('请在 Secrets 中配置 Supabase 密钥');
      } else {
        showToast('数据库连接失败，进入演示模式');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Toast helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // Filtering
  const filteredQA = useMemo(() => {
    return qaList.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.script.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [qaList, selectedCategory, searchQuery]);

  const filteredFeedback = useMemo(() => {
    return feedbackList
      .filter(item => item.user_voice.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.created_at - a.created_at);
  }, [feedbackList, searchQuery]);

  // Handlers
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('话术已复制到剪贴板');
  };

  const handleAddFeedback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      user_voice: formData.get('user_voice') as string,
      channel: formData.get('channel') as FeedbackChannel,
      submitter: '客服专员',
    };

    try {
      const { error } = await supabase.from('feedback').insert([payload]);
      if (error) throw error;
      
      showToast('反馈提交成功');
      setShowNewFeedbackModal(false);
      fetchData(); // Refresh list
    } catch (error) {
      console.error('Submit error:', error);
      showToast('提交失败，请检查数据库配置');
    }
  };

  const handleStatusChange = async (recordId: string, status: FeedbackStatus) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status })
        .eq('id', recordId);
        
      if (error) throw error;
      
      showToast('状态已更新');
      fetchData(); // Refresh list
    } catch (error) {
      console.error('Update error:', error);
      showToast('更新失败');
    }
  };

  const handleConvertToQA = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showConvertModal || !showConvertModal.recordId) return;

    const formData = new FormData(e.currentTarget);
    const qaData = {
      id: `Q-${(qaList.length + 1).toString().padStart(3, '0')}`,
      category: formData.get('category') as QACategory,
      question: formData.get('question') as string,
      script: formData.get('script') as string,
      notes: formData.get('notes') as string,
    };

    try {
      // 1. Create QA entry
      const { error: qaError } = await supabase.from('qa').insert([qaData]);
      if (qaError) throw qaError;

      // 2. Update feedback status to RESOLVED
      const { error: feedbackError } = await supabase
        .from('feedback')
        .update({ status: FeedbackStatus.RESOLVED })
        .eq('id', showConvertModal.recordId);
      if (feedbackError) throw feedbackError;

      showToast('已成功转为官方问答');
      setShowConvertModal(null);
      fetchData(); // Refresh both lists
    } catch (error) {
      console.error('Convert error:', error);
      showToast('转换失败');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-screen bg-white text-apple-text font-sans overflow-hidden"
    >
      {/* Sidebar */}
      <aside className="w-72 bg-apple-gray-50 border-r border-apple-gray-100 flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 font-bold text-2xl tracking-tighter text-apple-text">
            <div className="w-10 h-10 bg-apple-blue rounded-xl flex items-center justify-center text-white shadow-lg shadow-apple-blue/20">
              <BookOpen size={22} />
            </div>
            MagicFrame
          </div>
          <p className="text-[11px] text-apple-gray-300 mt-2 uppercase tracking-[0.2em] font-bold">Internal CS Hub</p>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('qa')}
            className={`w-full apple-sidebar-item ${activeTab === 'qa' ? 'apple-sidebar-item-active' : 'apple-sidebar-item-inactive'}`}
          >
            <BookOpen size={18} />
            官方问答参考库
          </button>
          
          {activeTab === 'qa' && (
            <div className="ml-6 mt-2 space-y-1 border-l border-apple-gray-200 pl-4">
              <button 
                onClick={() => setSelectedCategory('all')}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-all ${selectedCategory === 'all' ? 'text-apple-blue font-semibold bg-apple-blue/5' : 'text-apple-gray-300 hover:text-apple-text'}`}
              >
                全部类别
              </button>
              {Object.values(QACategory).map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-all ${selectedCategory === cat ? 'text-apple-blue font-semibold bg-apple-blue/5' : 'text-apple-gray-300 hover:text-apple-text'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <button 
            onClick={() => setActiveTab('feedback')}
            className={`w-full apple-sidebar-item mt-2 ${activeTab === 'feedback' ? 'apple-sidebar-item-active' : 'apple-sidebar-item-inactive'}`}
          >
            <MessageSquare size={18} />
            用户问题池
          </button>
        </nav>

        <div className="p-6 border-t border-apple-gray-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-apple-gray-300">Database Status</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-apple-red animate-pulse' : 'bg-apple-green'}`} />
              <span className={`text-[10px] font-bold ${isDemoMode ? 'text-apple-red' : 'text-apple-green'}`}>
                {isDemoMode ? 'DEMO MODE' : 'CONNECTED'}
              </span>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 flex items-center gap-4 border border-apple-gray-100 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-apple-gray-100 flex items-center justify-center text-apple-text font-bold text-sm">
              D
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Dong</p>
              <p className="text-[11px] text-apple-gray-300 truncate">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <header className="h-20 apple-glass px-10 flex items-center justify-between gap-8 sticky top-0 z-10">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray-300 group-focus-within:text-apple-blue transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="搜索问题、话术或关键字..."
              className="w-full pl-11 pr-4 py-3 apple-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowNewFeedbackModal(true)}
            className="apple-button-primary flex items-center gap-2"
          >
            <Plus size={18} />
            新建反馈
          </button>
        </header>

        {/* Demo Mode Banner */}
        {isDemoMode && !isLoading && (
          <div className="bg-apple-orange/10 border-b border-apple-orange/20 px-10 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-apple-orange text-xs font-semibold">
              <AlertCircle size={14} />
              <span>演示模式：尚未配置飞书 API 密钥，当前显示为模拟数据。</span>
            </div>
            <a 
              href="https://open.feishu.cn/app" 
              target="_blank" 
              rel="noreferrer"
              className="text-[10px] bg-apple-orange/20 text-apple-orange px-3 py-1 rounded-full font-bold hover:bg-apple-orange/30 transition-all whitespace-nowrap"
            >
              配置飞书 API
            </a>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-apple-gray-300">
              <div className="w-12 h-12 border-4 border-apple-blue border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-sm font-medium tracking-tight">正在同步飞书数据...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'qa' ? (
                <motion.div 
                  key="qa"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  className="grid grid-cols-1 xl:grid-cols-2 gap-8"
                >
                  {filteredQA.map(item => (
                    <div key={item.id} className="apple-card p-8 group">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <CategoryBadge category={item.category} />
                          <span className="text-[11px] font-bold text-apple-gray-300 tracking-widest">{item.id}</span>
                        </div>
                        <button 
                          onClick={() => handleCopy(item.script)}
                          className="flex items-center gap-2 px-4 py-2 bg-apple-blue-light text-apple-blue rounded-full text-xs font-bold hover:bg-apple-blue hover:text-white transition-all opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 whitespace-nowrap"
                        >
                          <Copy size={14} />
                          复制话术
                        </button>
                      </div>
                      <h3 className="text-xl font-bold text-apple-text mb-4 leading-tight tracking-tight">{item.question}</h3>
                      <div className="bg-apple-gray-50 rounded-2xl p-6 mb-6 border border-apple-gray-100">
                        <p className="text-[15px] text-apple-text leading-relaxed font-light italic">“{item.script}”</p>
                      </div>
                      <div className="flex items-start gap-3 text-apple-gray-300 bg-apple-gray-50/50 p-4 rounded-xl">
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-apple-blue" />
                        <p className="text-xs leading-relaxed">{item.notes}</p>
                      </div>
                    </div>
                  ))}
                  {filteredQA.length === 0 && (
                    <div className="col-span-full py-32 text-center">
                      <div className="w-20 h-20 bg-apple-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-apple-gray-200">
                        <Search size={40} />
                      </div>
                      <h3 className="text-xl font-bold text-apple-text mb-2">未找到匹配内容</h3>
                      <p className="text-apple-gray-300 text-sm">尝试更换关键词或分类</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="feedback"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  className="space-y-6"
                >
                  <div className="apple-card overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-apple-gray-50/50 border-b border-apple-gray-100">
                          <th className="px-8 py-5 text-[11px] font-bold text-apple-gray-300 uppercase tracking-[0.2em]">状态</th>
                          <th className="px-8 py-5 text-[11px] font-bold text-apple-gray-300 uppercase tracking-[0.2em]">用户原声</th>
                          <th className="px-8 py-5 text-[11px] font-bold text-apple-gray-300 uppercase tracking-[0.2em]">渠道</th>
                          <th className="px-8 py-5 text-[11px] font-bold text-apple-gray-300 uppercase tracking-[0.2em]">提交人</th>
                          <th className="px-8 py-5 text-[11px] font-bold text-apple-gray-300 uppercase tracking-[0.2em] text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-apple-gray-100">
                        {filteredFeedback.map(item => (
                          <tr key={item.recordId} className="hover:bg-apple-gray-50/30 transition-colors group">
                            <td className="px-8 py-6">
                              <Badge status={item.status} />
                            </td>
                            <td className="px-8 py-6 max-w-xl">
                              <p className="text-[15px] font-semibold text-apple-text line-clamp-2 mb-1.5">{item.user_voice}</p>
                              <p className="text-[11px] text-apple-gray-300 font-medium">{new Date(item.created_at).toLocaleString()}</p>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-[11px] font-bold px-3 py-1 bg-apple-gray-100 rounded-full text-apple-text uppercase tracking-wider whitespace-nowrap">{item.channel}</span>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-apple-blue-light flex items-center justify-center text-[11px] font-bold text-apple-blue">
                                  {item.submitter[0]}
                                </div>
                                <span className="text-sm font-medium text-apple-text">{item.submitter}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-4">
                                <select 
                                  value={item.status}
                                  onChange={(e) => handleStatusChange(item.recordId!, e.target.value as FeedbackStatus)}
                                  className="text-xs bg-apple-gray-50 border-none rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-apple-blue/20 outline-none font-medium cursor-pointer"
                                >
                                  {Object.values(FeedbackStatus).map(s => (
                                    <option key={s} value={s}>{s === 'pending' ? '待解答' : s === 'processing' ? '处理中' : '已解决'}</option>
                                  ))}
                                </select>
                                {item.status !== FeedbackStatus.RESOLVED && (
                                  <button 
                                    onClick={() => setShowConvertModal(item)}
                                    className="flex items-center gap-2 px-4 py-2 bg-apple-blue text-white rounded-full text-xs font-bold hover:bg-[#0071E3] transition-all shadow-sm whitespace-nowrap"
                                  >
                                    <ExternalLink size={14} />
                                    转为问答
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredFeedback.length === 0 && (
                      <div className="py-32 text-center">
                        <p className="text-apple-gray-300 font-medium">暂无反馈记录</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {(showNewFeedbackModal || showConvertModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-apple-text/20 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-[28px] shadow-2xl w-full max-w-xl overflow-hidden border border-apple-gray-100"
            >
              <div className="px-8 py-6 border-b border-apple-gray-100 flex items-center justify-between bg-white">
                <h2 className="font-bold text-xl tracking-tight">{showNewFeedbackModal ? '新建反馈' : '转为官方问答'}</h2>
                <button 
                  onClick={() => { setShowNewFeedbackModal(false); setShowConvertModal(null); }} 
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-apple-gray-50 text-apple-gray-300 hover:text-apple-text transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              {showNewFeedbackModal ? (
                <form onSubmit={handleAddFeedback} className="p-8 space-y-6">
                  <div>
                    <label className="block text-[11px] font-bold text-apple-gray-300 uppercase mb-2 tracking-widest">用户原声 *</label>
                    <textarea 
                      name="user_voice"
                      required
                      placeholder="请输入用户反馈的具体内容..."
                      className="w-full apple-input h-40 resize-none py-4"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-apple-gray-300 uppercase mb-2 tracking-widest">来源渠道 *</label>
                    <select 
                      name="channel"
                      required
                      className="w-full apple-input cursor-pointer"
                    >
                      {Object.values(FeedbackChannel).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="pt-4 flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setShowNewFeedbackModal(false)}
                      className="flex-1 apple-button-secondary"
                    >
                      取消
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 apple-button-primary"
                    >
                      提交反馈
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConvertToQA} className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-apple-gray-300 uppercase mb-2 tracking-widest">分类 *</label>
                      <select 
                        name="category"
                        required
                        className="w-full apple-input cursor-pointer"
                      >
                        {Object.values(QACategory).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-apple-gray-300 uppercase mb-2 tracking-widest">标准问题 *</label>
                      <input 
                        name="question"
                        defaultValue={showConvertModal?.user_voice}
                        required
                        className="w-full apple-input"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-apple-gray-300 uppercase mb-2 tracking-widest">标准话术 (SOP) *</label>
                      <textarea 
                        name="script"
                        required
                        placeholder="请输入客服应答的标准话术..."
                        className="w-full apple-input h-32 resize-none py-4"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-apple-gray-300 uppercase mb-2 tracking-widest">内部备注</label>
                      <textarea 
                        name="notes"
                        placeholder="请输入内部注意事项..."
                        className="w-full apple-input h-20 resize-none py-4"
                      />
                    </div>
                  </div>
                  <div className="pt-4 flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setShowConvertModal(null)}
                      className="flex-1 apple-button-secondary"
                    >
                      取消
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 apple-button-primary"
                    >
                      确认转换并发布
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-apple-text/90 backdrop-blur-md text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border border-white/10"
          >
            <CheckCircle2 size={20} className="text-apple-green" />
            <span className="text-sm font-bold tracking-tight">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
