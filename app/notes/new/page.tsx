// app/(staff)/notes/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  StickyNote, 
  Calendar, 
  X,
  FileText,
  Save,
  AlertCircle,
  Pin,
  PinOff,
  ChevronRight,
  Tag,
  User,
  Sparkles,
  Archive,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Maximize2,
  Minimize2,
  Quote,
  Code,
  Undo,
  Redo,
  Palette,
  RemoveFormatting,
  Printer,
  Download,
  Eye,
  Moon,
  Sun,
  ChevronDown,
  Copy,
  CheckCheck,
  AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ─────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  content: string; // HTML string
  plainText: string; 
  category: 'research' | 'observation' | 'general' | 'urgent';
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isArchived: boolean;
  tags: string[];
  patientRef?: string;
  wordCount: number;
}

type NoteCategory = 'research' | 'observation' | 'general' | 'urgent';
type ViewMode = 'all' | 'pinned' | 'archived';
type Theme = 'light' | 'dark' | 'sepia';
type ToastType = 'success' | 'error' | 'info';

const CATEGORY_CONFIG: Record<NoteCategory, { 
  label: string; 
  color: string; 
  bg: string; 
  border: string; 
  dot: string;
}> = {
  research: {
    label: 'Research',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50/80 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  observation: {
    label: 'Observation',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50/80 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  general: {
    label: 'General',
    color: 'text-slate-700 dark:text-slate-400',
    bg: 'bg-slate-50/80 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-500',
  },
  urgent: {
    label: 'Urgent',
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50/80 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  }
};

const STORAGE_KEY = 'hospital_staff_notes_v5';
const THEME_KEY = 'hospital_notes_theme';

// ─── Animation Variants ────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 350, damping: 28 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.94, 
    y: -8,
    transition: { duration: 0.15 }
  }
};

const slideIn = {
  hidden: { x: -16, opacity: 0 },
  show: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 400, damping: 30 } }
};

const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25 } }
};


// ─── Toast Component ───────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-emerald-500 shadow-emerald-500/25',
    error: 'bg-rose-500 shadow-rose-500/25',
    info: 'bg-indigo-500 shadow-indigo-500/25'
  };

  const icons = {
    success: <CheckCheck className="w-4 h-4" />,
    error: <AlertTriangle className="w-4 h-4" />,
    info: <Sparkles className="w-4 h-4" />
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 20, x: '-50%' }}
      className={`fixed bottom-6 left-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 ${colors[type]} text-white rounded-2xl shadow-lg backdrop-blur-sm`}
    >
      {icons[type]}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function StaffNotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alphabetical'>('newest');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const [showToolbarDropdown, setShowToolbarDropdown] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<NoteCategory>('general');
  const [formPatientRef, setFormPatientRef] = useState('');
  const [formTags, setFormTags] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // ─── Helpers ────────────────────────────────────────────────────

  const generateId = () => `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const stripHtml = (html: string) => {
    if (typeof window === 'undefined') return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };
  
  const countWords = (text: string) => text.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  // ─── Load/Save from localStorage ────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const validNotes = Array.isArray(parsed) ? parsed.filter((n: any) => n && n.id) : [];
        setNotes(validNotes);
      }
      const savedTheme = localStorage.getItem(THEME_KEY) as Theme;
      if (savedTheme && ['light', 'dark', 'sepia'].includes(savedTheme)) {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
      showToast('Failed to load saved notes', 'error');
    } finally {
      setIsLoaded(true);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (error) {
      console.error('Failed to save notes:', error);
      showToast('Failed to save notes', 'error');
    }
  }, [notes, isLoaded, showToast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme]);

  // ─── Editor Commands ────────────────────────────────────────────

  const updateActiveFormats = useCallback(() => {
    try {
      const formats = new Set<string>();
      if (document.queryCommandState('bold')) formats.add('bold');
      if (document.queryCommandState('italic')) formats.add('italic');
      if (document.queryCommandState('underline')) formats.add('underline');
      if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
      if (document.queryCommandState('insertUnorderedList')) formats.add('insertUnorderedList');
      if (document.queryCommandState('insertOrderedList')) formats.add('insertOrderedList');
      const formatBlock = document.queryCommandValue('formatBlock');
      if (formatBlock === 'h1') formats.add('h1');
      if (formatBlock === 'h2') formats.add('h2');
      if (formatBlock === 'h3') formats.add('h3');
      if (document.queryCommandState('justifyLeft')) formats.add('justifyLeft');
      if (document.queryCommandState('justifyCenter')) formats.add('justifyCenter');
      if (document.queryCommandState('justifyRight')) formats.add('justifyRight');
      setActiveFormats(formats);
    } catch (e) {
      // ignore
    }
  }, []);

  const execCmd = useCallback((command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateActiveFormats();
  }, [updateActiveFormats]);

  const handleCloseEditor = useCallback(() => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Discard them?')) {
        setIsEditorOpen(false);
        setSelectedNoteId(null);
        setIsDirty(false);
        setShowToolbarDropdown(false);
      }
    } else {
      setIsEditorOpen(false);
      setSelectedNoteId(null);
      setShowToolbarDropdown(false);
    }
  }, [isDirty]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchInputRef.current?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); document.getElementById('btn-create-new')?.click(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (isEditorOpen) document.getElementById('btn-save-note')?.click(); }
      if (e.key === 'Escape') {
        if (showToolbarDropdown) setShowToolbarDropdown(false);
        else if (isEditorOpen) handleCloseEditor();
      }
      if (isEditorOpen && (e.metaKey || e.ctrlKey)) {
        switch (e.key.toLowerCase()) {
          case 'b': e.preventDefault(); execCmd('bold'); break;
          case 'i': e.preventDefault(); execCmd('italic'); break;
          case 'u': e.preventDefault(); execCmd('underline'); break;
          case 'z': e.shiftKey ? execCmd('redo') : execCmd('undo'); e.preventDefault(); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorOpen, showToolbarDropdown, execCmd, handleCloseEditor]);

  // ─── CRUD Operations ────────────────────────────────────────────

  const handleCreateNew = useCallback(() => {
    setSelectedNoteId(null);
    setFormTitle('');
    setFormCategory('general');
    setFormPatientRef('');
    setFormTags('');
    setIsDirty(false);
    setIsEditorOpen(true);
  }, []);

  const handleEditNote = useCallback((note: Note) => {
    setSelectedNoteId(note.id);
    setFormTitle(note.title);
    setFormCategory(note.category);
    setFormPatientRef(note.patientRef || '');
    setFormTags(note.tags.join(', '));
    setIsDirty(false);
    setIsEditorOpen(true);
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const loadContent = () => {
      if (editorRef.current) {
        const targetNote = notesRef.current.find(n => n.id === selectedNoteId);
        editorRef.current.innerHTML = targetNote?.content || '<p><br></p>';
        editorRef.current.focus();
        updateActiveFormats();
      } else if (isEditorOpen) {
        timeoutId = setTimeout(loadContent, 10);
      }
    };

    if (isEditorOpen) {
      loadContent();
    }

    return () => clearTimeout(timeoutId);
  }, [selectedNoteId, isEditorOpen, updateActiveFormats]);

  const handleSaveNote = useCallback(() => {
    const content = editorRef.current?.innerHTML || '<p><br></p>';
    const plainText = stripHtml(content);
    
    if (!formTitle.trim() && !plainText.trim()) {
      showToast('Please add a title or content', 'error');
      return;
    }

    const wordCount = countWords(plainText);

    if (selectedNoteId) {
      setNotes(prev => prev.map(note => 
        note.id === selectedNoteId 
          ? {
              ...note,
              title: formTitle.trim() || 'Untitled Note',
              content,
              plainText,
              category: formCategory,
              updatedAt: new Date().toISOString(),
              tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
              patientRef: formPatientRef.trim() || undefined,
              wordCount
            }
          : note
      ));
      showToast('Note saved', 'success');
    } else {
      const newNote: Note = {
        id: generateId(),
        title: formTitle.trim() || 'Untitled Note',
        content,
        plainText,
        category: formCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPinned: false,
        isArchived: false,
        tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
        patientRef: formPatientRef.trim() || undefined,
        wordCount
      };
      setNotes(prev => [newNote, ...prev]);
      setSelectedNoteId(newNote.id);
      showToast('Note created', 'success');
    }
    setIsDirty(false);
  }, [formTitle, formCategory, formTags, formPatientRef, selectedNoteId, showToast]);

  const handleDeleteNote = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm('Delete this note permanently? This cannot be undone.')) {
      setNotes(prev => prev.filter(note => note.id !== id));
      if (selectedNoteId === id) handleCloseEditor();
      showToast('Note deleted', 'info');
    }
  }, [selectedNoteId, handleCloseEditor, showToast]);

  const handleArchiveNote = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes(prev => prev.map(note => note.id === id ? { ...note, isArchived: !note.isArchived } : note));
    const note = notesRef.current.find(n => n.id === id);
    if (selectedNoteId === id && note && !note.isArchived) handleCloseEditor();
    showToast(note?.isArchived ? 'Note unarchived' : 'Note archived', 'info');
  }, [selectedNoteId, handleCloseEditor, showToast]);

  const togglePin = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes(prev => prev.map(note => note.id === id ? { ...note, isPinned: !note.isPinned } : note));
    const note = notesRef.current.find(n => n.id === id);
    showToast(note?.isPinned ? 'Note unpinned' : 'Note pinned', 'success');
  }, [showToast]);

  const handleExport = useCallback(() => {
    const note = notesRef.current.find(n => n.id === selectedNoteId);
    if (!note) return;
    const blob = new Blob([
      `${note.title}\n${'='.repeat(note.title.length)}\n\n` +
      `Category: ${CATEGORY_CONFIG[note.category].label}\n` +
      `Patient: ${note.patientRef || 'N/A'}\n` +
      `Tags: ${note.tags.join(', ') || 'None'}\n` +
      `Created: ${format(new Date(note.createdAt), 'PPP p')}\n` +
      `Updated: ${format(new Date(note.updatedAt), 'PPP p')}\n` +
      `Word Count: ${note.wordCount}\n\n---\n\n` +
      stripHtml(note.content)
    ], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Note exported', 'success');
  }, [selectedNoteId, showToast]);

  const handlePrint = useCallback(() => {
    const note = notesRef.current.find(n => n.id === selectedNoteId);
    if (!note) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return showToast('Popup blocked. Please allow popups.', 'error');
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>${note.title.replace(/</g, '&lt;')}</title>
      <style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:40px auto;line-height:1.7;color:#1a1a1a;padding:20px}h1{border-bottom:2px solid #e5e7eb;padding-bottom:12px}.meta{color:#6b7280;font-size:13px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f3f4f6}</style></head>
      <body><h1>${note.title.replace(/</g, '&lt;')}</h1><div class="meta"><p><strong>Category:</strong> ${CATEGORY_CONFIG[note.category].label}</p></div><div class="content">${note.content}</div></body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }, [selectedNoteId, showToast]);

  const handleDuplicateNote = useCallback(() => {
    const note = notesRef.current.find(n => n.id === selectedNoteId);
    if (!note) return;
    const duplicated: Note = { ...note, id: generateId(), title: `${note.title} (Copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isPinned: false, isArchived: false };
    setNotes(prev => [duplicated, ...prev]);
    handleEditNote(duplicated);
    showToast('Note duplicated', 'success');
  }, [selectedNoteId, handleEditNote, showToast]);

  const handleBackupAll = useCallback(() => {
    if (notesRef.current.length === 0) {
      showToast('No notes to backup', 'error');
      return;
    }

    let backupText = `HOSPITAL STAFF NOTES BACKUP\nDate: ${format(new Date(), 'PPP p')}\nTotal Notes: ${notesRef.current.length}\n\n`;
    backupText += `=========================================================\n\n`;

    notesRef.current.forEach(note => {
      backupText += `TITLE: ${note.title}\n`;
      backupText += `CATEGORY: ${CATEGORY_CONFIG[note.category].label}\n`;
      if (note.patientRef) backupText += `PATIENT: ${note.patientRef}\n`;
      backupText += `DATE: ${format(new Date(note.updatedAt), 'PPP p')}\n`;
      backupText += `---------------------------------------------------------\n`;
      backupText += `${stripHtml(note.content)}\n\n`;
      backupText += `=========================================================\n\n`;
    });

    const blob = new Blob([backupText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Staff_Notes_Backup_${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('All notes backed up successfully!', 'success');
  }, [showToast]);

  // ─── Themes ───────────────────────────────────────────────────────
  const themeStyles = {
    light: {
      bg: 'bg-[#f8f9fa]',
      editorBg: 'bg-white',
      text: 'text-gray-900',
      sidebar: 'bg-white',
      border: 'border-gray-200',
      toolbar: 'bg-white/90 backdrop-blur-xl',
      placeholder: 'placeholder:text-gray-300',
      meta: 'text-gray-500',
      inputBg: 'bg-gray-50',
      cardBg: 'bg-white/60',
      cardHover: 'hover:bg-white hover:border-gray-200 hover:shadow-sm',
      cardActive: 'bg-indigo-50/90 border-indigo-200 shadow-sm',
      textActive: 'text-indigo-900',
      btnHover: 'hover:bg-gray-100',
      btnActive: 'bg-gray-900 text-white',
      kbd: 'bg-gray-100 border-gray-200',
      toolbarBtnBase: 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
      toolbarBtnActive: 'bg-indigo-100 text-indigo-700 shadow-sm'
    },
    dark: {
      bg: 'bg-[#0f0f10]',
      editorBg: 'bg-[#1a1a1c]',
      text: 'text-gray-100',
      sidebar: 'bg-[#161618]',
      border: 'border-gray-800',
      toolbar: 'bg-[#1a1a1c]/90 backdrop-blur-xl',
      placeholder: 'placeholder:text-gray-600',
      meta: 'text-gray-400',
      inputBg: 'bg-[#252528]',
      cardBg: 'bg-[#1a1a1c]/60',
      cardHover: 'hover:bg-[#252528] hover:border-gray-700',
      cardActive: 'bg-indigo-900/20 border-indigo-500/40 shadow-sm',
      textActive: 'text-indigo-300',
      btnHover: 'hover:bg-[#252528]',
      btnActive: 'bg-indigo-600 text-white',
      kbd: 'bg-[#252528] border-gray-700',
      toolbarBtnBase: 'text-gray-400 hover:text-gray-100 hover:bg-[#252528]',
      toolbarBtnActive: 'bg-indigo-500/20 text-indigo-300 shadow-sm'
    },
    sepia: {
      bg: 'bg-[#f4ecd8]',
      editorBg: 'bg-[#fdf6e3]',
      text: 'text-[#5b4636]',
      sidebar: 'bg-[#eee8d5]',
      border: 'border-[#d3cbb8]',
      toolbar: 'bg-[#fdf6e3]/90 backdrop-blur-xl',
      placeholder: 'placeholder:text-[#b8a99a]',
      meta: 'text-[#8b7355]',
      inputBg: 'bg-[#f0e9d6]',
      cardBg: 'bg-[#fdf6e3]/60',
      cardHover: 'hover:bg-[#fdf6e3] hover:border-[#d3cbb8]',
      cardActive: 'bg-amber-100/90 border-amber-300 shadow-sm',
      textActive: 'text-amber-900',
      btnHover: 'hover:bg-[#e4dcba]',
      btnActive: 'bg-[#5b4636] text-[#fdf6e3]',
      kbd: 'bg-[#e4dcba] border-[#d3cbb8]',
      toolbarBtnBase: 'text-[#8b7355] hover:text-[#5b4636] hover:bg-[#e4dcba]',
      toolbarBtnActive: 'bg-amber-200/50 text-amber-900 shadow-sm'
    }
  };

  const t = themeStyles[theme];

  function ToolbarBtn({ icon, label, isActive, onClick }: { icon: React.ReactNode; label: string; isActive?: boolean; onClick: () => void; }) {
    return (
      <button onClick={onClick} title={label} className={`p-2 rounded-lg transition-all duration-150 ${isActive ? t.toolbarBtnActive : t.toolbarBtnBase}`}>
        {icon}
      </button>
    );
  }

  const activeNotes = notes.filter(n => !n.isArchived);
  const archivedNotes = notes.filter(n => n.isArchived);

  const filteredNotes = (viewMode === 'archived' ? archivedNotes : activeNotes).filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.plainText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.patientRef?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    const matchesView = viewMode === 'all' || viewMode === 'archived' || (viewMode === 'pinned' && note.isPinned);
    return matchesSearch && matchesCategory && matchesView;
  }).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    switch (sortBy) {
      case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'alphabetical': return a.title.localeCompare(b.title);
      default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const selectedNote = notes.find(n => n.id === selectedNoteId);
  const pinnedCount = activeNotes.filter(n => n.isPinned).length;

  // ─── Render ─────────────────────────────────────────────────────

  if (!isLoaded) {
    return (
      <div className={`h-screen flex items-center justify-center ${t.bg}`}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={`h-screen ${t.bg} flex overflow-hidden transition-colors duration-300`}>
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* ═══ SIDEBARs ═══════════════════════════════════════════════ */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarCollapsed ? 72 : 340 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        // FIX: Removed `overflow-hidden` from this outer container so the arrow button isn't cut off
        className={`${t.sidebar} border-r ${t.border} shrink-0 relative z-40 transition-colors duration-300`}
      >
        {/* FIX: Added a new full-width container that specifically hides the text overflow */}
        <div className="w-full h-full overflow-hidden">
          <div className="w-[340px] h-full flex flex-col py-5">
            
            {/* Header / Logo */}
            {/* FIX: Spacing optimized (12px padding + 48px wrapper + 12px remaining = perfectly centered in 72px) */}
            <div className="flex items-center px-3 mb-6">
              <div className="w-12 flex justify-center shrink-0">
                <motion.div whileHover={{ scale: 1.08, rotate: 3 }} className="w-10 h-10 bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <StickyNote className="w-5 h-5 text-white" />
                </motion.div>
              </div>
              <div className="ml-2 transition-opacity duration-200" style={{ opacity: isSidebarCollapsed ? 0 : 1 }}>
                <h1 className={`text-lg font-bold ${t.text} leading-tight`}>Staff Notes</h1>
                <p className={`text-xs ${t.meta} font-medium`}>{activeNotes.length} notes • {pinnedCount} pinned</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-3 flex flex-col gap-2 mb-6">
              <motion.button id="btn-create-new" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleCreateNew} className={`relative h-11 flex items-center ${t.btnActive} rounded-xl font-medium text-sm shadow-md`}>
                <div className="w-12 flex justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="ml-1 whitespace-nowrap transition-opacity duration-200" style={{ opacity: isSidebarCollapsed ? 0 : 1 }}>New Note</span>
                <span className="absolute right-3 text-[10px] bg-black/20 px-1.5 py-0.5 rounded-md font-mono transition-opacity duration-200" style={{ opacity: isSidebarCollapsed ? 0 : 1 }}>⌘N</span>
              </motion.button>
              
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleBackupAll} className={`relative h-11 flex items-center ${t.inputBg} ${t.text} ${t.btnHover} border ${t.border} rounded-xl font-medium text-sm shadow-sm`}>
                <div className="w-12 flex justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <span className="ml-1 whitespace-nowrap transition-opacity duration-200" style={{ opacity: isSidebarCollapsed ? 0 : 1 }}>Backup All Notes</span>
              </motion.button>
            </div>

            {/* Hidden Area when Collapsed (Search, Tabs, List) */}
            <div className="flex-1 flex flex-col min-h-0 transition-opacity duration-200" style={{ opacity: isSidebarCollapsed ? 0 : 1, pointerEvents: isSidebarCollapsed ? 'none' : 'auto' }}>
              
              {/* Search */}
              <div className="px-4 mb-3 shrink-0">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes..." tabIndex={isSidebarCollapsed ? -1 : 0} className={`w-full pl-9 pr-10 py-2.5 ${t.inputBg} border ${t.border} rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm ${t.text}`} />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ${t.meta} font-mono ${t.kbd} px-1 rounded`}>⌘K</span>
                </div>
              </div>

              {/* View Tabs */}
              <div className="px-4 mb-3 shrink-0">
                <div className={`flex gap-1 p-1 ${t.inputBg} rounded-xl`}>
                  {(['all', 'pinned', 'archived'] as ViewMode[]).map((mode) => (
                    <button key={mode} onClick={() => setViewMode(mode)} tabIndex={isSidebarCollapsed ? -1 : 0} className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${viewMode === mode ? `${t.editorBg} ${t.text} shadow-sm` : `${t.meta} ${t.btnHover}`}`}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categories */}
              {viewMode !== 'archived' && (
                <div className="px-4 mb-2 shrink-0">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setSelectedCategory('all')} tabIndex={isSidebarCollapsed ? -1 : 0} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedCategory === 'all' ? t.btnActive : `${t.inputBg} ${t.meta} ${t.btnHover}`}`}>All</button>
                    {(Object.keys(CATEGORY_CONFIG) as NoteCategory[]).map((cat) => (
                      <button key={cat} onClick={() => setSelectedCategory(cat)} tabIndex={isSidebarCollapsed ? -1 : 0} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${selectedCategory === cat ? `${CATEGORY_CONFIG[cat].bg} ${CATEGORY_CONFIG[cat].color} ring-1 ${CATEGORY_CONFIG[cat].border}` : `${t.inputBg} ${t.meta} ${t.btnHover}`}`}>
                        <span className={`w-2 h-2 rounded-full ${CATEGORY_CONFIG[cat].dot}`} />{CATEGORY_CONFIG[cat].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort */}
              <div className="px-4 mb-2 flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold ${t.meta} uppercase tracking-wider`}>Sort</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} tabIndex={isSidebarCollapsed ? -1 : 0} className={`text-xs ${t.meta} bg-transparent outline-none cursor-pointer ${t.btnHover} font-medium`}>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </div>

              {/* Notes List */}
              <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {filteredNotes.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 px-4">
                      <div className={`w-16 h-16 ${t.inputBg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                        {viewMode === 'archived' ? <Archive className={`w-7 h-7 ${t.meta}`} /> : <Search className={`w-7 h-7 ${t.meta}`} />}
                      </div>
                      <p className={`text-sm ${t.meta} font-medium`}>{viewMode === 'archived' ? 'No archived notes' : 'No notes found'}</p>
                    </motion.div>
                  ) : (
                    filteredNotes.map((note) => {
                      const config = CATEGORY_CONFIG[note.category];
                      const isSelected = selectedNoteId === note.id;
                      
                      return (
                        <motion.div key={note.id} layout variants={cardVariants} initial="hidden" animate="show" exit="exit" onClick={() => !isSidebarCollapsed && handleEditNote(note)} className={`group relative p-3.5 rounded-xl cursor-pointer transition-all border ${isSelected ? t.cardActive : `${t.cardBg} border-transparent ${t.cardHover}`}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${config.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={`text-sm font-bold truncate ${isSelected ? t.textActive : t.text}`}>{note.title}</h3>
                                {note.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                              </div>
                              <p className={`text-xs ${t.meta} line-clamp-2 leading-relaxed mb-2`}>{note.plainText || 'No content'}</p>
                              <div className={`flex items-center gap-2.5 text-[10px] ${t.meta} font-medium`}>
                                <span>{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</span>
                                {note.wordCount > 0 && <><span className={`w-0.5 h-0.5 rounded-full ${t.meta}`} /><span>{note.wordCount} words</span></>}
                              </div>
                            </div>
                          </div>

                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all flex gap-0.5">
                            <button onClick={(e) => togglePin(note.id, e)} className={`p-1.5 rounded-lg ${t.btnHover} ${t.meta} hover:text-amber-500 transition-colors`}>
                              {note.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={(e) => handleArchiveNote(note.id, e)} className={`p-1.5 rounded-lg ${t.btnHover} ${t.meta} transition-colors`}>
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>

            </div>
          </div>
        </div>

        {/* FIX: Moved outside the hidden container and bumped z-index to 50 so it never hides behind the main windows */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-14 ${t.editorBg} border ${t.border} rounded-r-xl flex items-center justify-center shadow-sm hover:shadow-md transition-all z-50`}
        >
          <ChevronRight className={`w-3 h-3 ${t.meta} transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </motion.aside>

      {/* ═══ MAIN / EDITOR ═════════════════════════════════════════ */}
      <main className={`flex-1 flex flex-col min-w-0 transition-colors duration-300`}>
        <AnimatePresence mode="wait">
          {!isEditorOpen ? (
            /* Empty State */
            <motion.div key="empty" variants={fadeIn} initial="hidden" animate="show" exit="hidden" className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md px-6">
                <motion.div animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="w-28 h-28 bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-purple-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                  <StickyNote className="w-12 h-12 text-indigo-400" />
                </motion.div>
                <h2 className={`text-3xl font-bold ${t.text} mb-3`}>Clinical Notes</h2>
                <p className={`${t.meta} mb-8 leading-relaxed`}>Document research, patient observations, and clinical findings. Everything stays securely on your device.</p>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleCreateNew} className={`inline-flex items-center gap-2.5 px-7 py-3.5 ${t.btnActive} rounded-2xl font-semibold shadow-xl transition-all`}>
                  <Plus className="w-5 h-5" /> Create Note
                </motion.button>
                <div className={`mt-10 flex items-center justify-center gap-6 text-xs ${t.meta}`}>
                  <span className="flex items-center gap-1.5"><kbd className={`px-2 py-1 ${t.kbd} rounded-lg text-[10px] font-mono border`}>⌘N</kbd> New</span>
                  <span className="flex items-center gap-1.5"><kbd className={`px-2 py-1 ${t.kbd} rounded-lg text-[10px] font-mono border`}>⌘K</kbd> Search</span>
                  <span className="flex items-center gap-1.5"><kbd className={`px-2 py-1 ${t.kbd} rounded-lg text-[10px] font-mono border`}>⌘S</kbd> Save</span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Editor */
            <motion.div key="editor" variants={slideIn} initial="hidden" animate="show" exit="hidden" className={`flex-1 flex flex-col ${isFullscreen ? `fixed inset-0 z-50 ${t.bg}` : ''}`}>
              {/* Toolbar */}
              <div className={`${t.toolbar} border-b ${t.border} px-4 py-2 flex items-center justify-between shrink-0 sticky top-0 z-10 transition-colors duration-300`}>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <button onClick={handleCloseEditor} className={`p-2 ${t.btnHover} rounded-xl ${t.meta} transition-colors shrink-0`} title="Close (Esc)"><X className="w-4 h-4" /></button>
                  <div className={`w-px h-5 ${t.border} mx-1 shrink-0`} />
                  
                  <div className={`flex items-center gap-0.5 ${t.inputBg} rounded-xl p-1 border ${t.border} shrink-0`}>
                    <ToolbarBtn icon={<Undo className="w-4 h-4" />} label="Undo (⌘Z)" onClick={() => execCmd('undo')} />
                    <ToolbarBtn icon={<Redo className="w-4 h-4" />} label="Redo (⌘⇧Z)" onClick={() => execCmd('redo')} />
                  </div>
                  <div className={`w-px h-5 ${t.border} mx-1 shrink-0`} />

                  <div className={`flex items-center gap-0.5 ${t.inputBg} rounded-xl p-1 border ${t.border} shrink-0`}>
                    <ToolbarBtn icon={<Bold className="w-4 h-4" />} label="Bold (⌘B)" isActive={activeFormats.has('bold')} onClick={() => execCmd('bold')} />
                    <ToolbarBtn icon={<Italic className="w-4 h-4" />} label="Italic (⌘I)" isActive={activeFormats.has('italic')} onClick={() => execCmd('italic')} />
                    <ToolbarBtn icon={<Underline className="w-4 h-4" />} label="Underline (⌘U)" isActive={activeFormats.has('underline')} onClick={() => execCmd('underline')} />
                    <ToolbarBtn icon={<Strikethrough className="w-4 h-4" />} label="Strikethrough" isActive={activeFormats.has('strikeThrough')} onClick={() => execCmd('strikeThrough')} />
                  </div>
                  <div className={`w-px h-5 ${t.border} mx-1 shrink-0`} />

                  <div className={`flex items-center gap-0.5 ${t.inputBg} rounded-xl p-1 border ${t.border} shrink-0`}>
                    <ToolbarBtn icon={<Heading1 className="w-4 h-4" />} label="Heading 1" isActive={activeFormats.has('h1')} onClick={() => execCmd('formatBlock', 'H1')} />
                    <ToolbarBtn icon={<Heading2 className="w-4 h-4" />} label="Heading 2" isActive={activeFormats.has('h2')} onClick={() => execCmd('formatBlock', 'H2')} />
                    <ToolbarBtn icon={<Heading3 className="w-4 h-4" />} label="Heading 3" isActive={activeFormats.has('h3')} onClick={() => execCmd('formatBlock', 'H3')} />
                  </div>
                  <div className={`w-px h-5 ${t.border} mx-1 shrink-0`} />

                  <div className={`flex items-center gap-0.5 ${t.inputBg} rounded-xl p-1 border ${t.border} shrink-0`}>
                    <ToolbarBtn icon={<List className="w-4 h-4" />} label="Bullet List" isActive={activeFormats.has('insertUnorderedList')} onClick={() => execCmd('insertUnorderedList')} />
                    <ToolbarBtn icon={<ListOrdered className="w-4 h-4" />} label="Numbered List" isActive={activeFormats.has('insertOrderedList')} onClick={() => execCmd('insertOrderedList')} />
                  </div>
                  <div className={`w-px h-5 ${t.border} mx-1 shrink-0`} />

                  <div className={`flex items-center gap-0.5 ${t.inputBg} rounded-xl p-1 border ${t.border} shrink-0 relative`}>
                    <ToolbarBtn icon={<AlignLeft className="w-4 h-4" />} label="Align Left" isActive={activeFormats.has('justifyLeft')} onClick={() => execCmd('justifyLeft')} />
                    <ToolbarBtn icon={<AlignCenter className="w-4 h-4" />} label="Align Center" isActive={activeFormats.has('justifyCenter')} onClick={() => execCmd('justifyCenter')} />
                    <button
                      onClick={() => setShowToolbarDropdown(!showToolbarDropdown)}
                      className={`p-2 rounded-lg transition-all ${showToolbarDropdown ? t.toolbarBtnActive : t.toolbarBtnBase}`}
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${showToolbarDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showToolbarDropdown && (
                        <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} className={`absolute top-full left-0 mt-2 ${t.editorBg} border ${t.border} rounded-xl shadow-xl p-3 z-50 min-w-[220px]`}>
                          <div className={`text-[10px] font-bold ${t.meta} uppercase tracking-widest mb-2`}>Text Color</div>
                          <div className="grid grid-cols-5 gap-1 mb-3">
                            {['#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#78716c', '#ffffff'].map(color => (
                              <button key={color} onClick={() => { execCmd('foreColor', color); setShowToolbarDropdown(false); }} className={`w-8 h-8 rounded-lg border ${t.border} hover:scale-110 transition-transform`} style={{ backgroundColor: color }} />
                            ))}
                          </div>
                          <div className={`border-t ${t.border} pt-2 space-y-0.5`}>
                            <button onClick={() => { execCmd('removeFormat'); setShowToolbarDropdown(false); }} className={`w-full flex items-center gap-2.5 px-2 py-2 text-xs ${t.text} ${t.btnHover} rounded-lg`}><RemoveFormatting className="w-3.5 h-3.5" /> Clear Formatting</button>
                            <button onClick={() => { execCmd('formatBlock', 'BLOCKQUOTE'); setShowToolbarDropdown(false); }} className={`w-full flex items-center gap-2.5 px-2 py-2 text-xs ${t.text} ${t.btnHover} rounded-lg`}><Quote className="w-3.5 h-3.5" /> Blockquote</button>
                            <button onClick={() => { execCmd('formatBlock', 'PRE'); setShowToolbarDropdown(false); }} className={`w-full flex items-center gap-2.5 px-2 py-2 text-xs ${t.text} ${t.btnHover} rounded-lg`}><Code className="w-3.5 h-3.5" /> Code Block</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className={`flex items-center gap-0.5 ${t.inputBg} rounded-xl p-1 border ${t.border}`}>
                    <button onClick={() => setTheme('light')} className={`p-1.5 rounded-lg transition-colors ${theme === 'light' ? `${t.editorBg} shadow-sm text-amber-500` : `${t.meta} ${t.btnHover}`}`}><Sun className="w-4 h-4" /></button>
                    <button onClick={() => setTheme('sepia')} className={`p-1.5 rounded-lg transition-colors ${theme === 'sepia' ? `${t.editorBg} shadow-sm text-amber-700` : `${t.meta} ${t.btnHover}`}`}><Palette className="w-4 h-4" /></button>
                    <button onClick={() => setTheme('dark')} className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? `${t.editorBg} shadow-sm text-indigo-500` : `${t.meta} ${t.btnHover}`}`}><Moon className="w-4 h-4" /></button>
                  </div>

                  <div className={`w-px h-5 ${t.border}`} />
                  {isDirty && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-amber-600 font-semibold flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20"><AlertCircle className="w-3 h-3" /> Unsaved</motion.span>}
                  <button onClick={() => setIsFullscreen(!isFullscreen)} className={`p-2 ${t.btnHover} rounded-xl ${t.meta}`} title="Fullscreen">{isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
                  <div className={`w-px h-5 ${t.border}`} />

                  <motion.button id="btn-save-note" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleSaveNote} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold text-sm shadow-md">
                    <Save className="w-4 h-4" /> Save
                  </motion.button>
                </div>
              </div>

              {/* Editor Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-8 py-8">
                  <input type="text" value={formTitle} onChange={(e) => { setFormTitle(e.target.value); setIsDirty(true); }} placeholder="Untitled Note" className={`w-full text-4xl font-bold ${t.text} ${t.placeholder} border-none outline-none bg-transparent mb-2`} />

                  <div className={`flex items-center gap-4 mb-6 pb-4 border-b ${t.border} ${t.meta}`}>
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /><span className="text-xs font-medium">{selectedNote ? format(new Date(selectedNote.updatedAt), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}</span></div>
                    <span className={`w-px h-3 ${t.border}`} />
                    <div className="flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /><span className="text-xs font-medium">{countWords(editorRef.current?.textContent || '')} words</span></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    <div className={`flex items-center gap-3 p-3 ${t.inputBg} rounded-xl border ${t.border}`}>
                      <Tag className={`w-4 h-4 ${t.meta}`} />
                      <div className="flex-1">
                        <label className={`block text-[10px] font-bold ${t.meta} uppercase tracking-widest mb-1`}>Category</label>
                        <select value={formCategory} onChange={(e) => { setFormCategory(e.target.value as NoteCategory); setIsDirty(true); }} className={`w-full bg-transparent text-sm font-semibold ${t.text} outline-none cursor-pointer`}>
                          <option value="general">General</option>
                          <option value="research">Research</option>
                          <option value="observation">Observation</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                    <div className={`flex items-center gap-3 p-3 ${t.inputBg} rounded-xl border ${t.border}`}>
                      <User className={`w-4 h-4 ${t.meta}`} />
                      <div className="flex-1">
                        <label className={`block text-[10px] font-bold ${t.meta} uppercase tracking-widest mb-1`}>Patient Ref</label>
                        <input type="text" value={formPatientRef} onChange={(e) => { setFormPatientRef(e.target.value); setIsDirty(true); }} placeholder="e.g., PT-001" className={`w-full bg-transparent text-sm ${t.text} ${t.placeholder} outline-none`} />
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <input type="text" value={formTags} onChange={(e) => { setFormTags(e.target.value); setIsDirty(true); }} placeholder="Add tags separated by commas..." className={`w-full px-4 py-2.5 ${t.inputBg} border ${t.border} rounded-xl text-sm ${t.text} ${t.placeholder} outline-none focus:ring-2 focus:ring-indigo-500/20`} />
                  </div>

                  <div className="relative">
                    <div
                      ref={editorRef}
                      contentEditable
                      onInput={() => { setIsDirty(true); updateActiveFormats(); }}
                      onKeyUp={updateActiveFormats}
                      onMouseUp={updateActiveFormats}
                      onClick={updateActiveFormats}
                      className={`w-full min-h-[450px] ${t.editorBg} rounded-2xl border ${t.border} p-6 ${t.text} leading-[1.8] text-[15px] outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all prose prose-sm max-w-none editor-content`}
                      style={{ minHeight: '450px' }}
                      suppressContentEditableWarning
                    />
                    <div className={`absolute top-6 left-6 pointer-events-none ${t.placeholder} text-[15px] leading-[1.8] transition-opacity`} style={{ opacity: editorRef.current?.textContent?.trim() ? 0 : 1, display: editorRef.current?.textContent?.trim() ? 'none' : 'block' }}>
                      Start typing your clinical notes here...<br />
                      <span className="text-sm opacity-50">Use the toolbar for formatting, or keyboard shortcuts like ⌘B for bold.</span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className={`mt-8 pt-6 border-t ${t.border} flex items-center justify-between flex-wrap gap-3`}>
                    <div className="flex items-center gap-1">
                      {selectedNote && (
                        <>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDuplicateNote} className={`flex items-center gap-1.5 px-3 py-2 text-sm ${t.meta} ${t.btnHover} rounded-xl`}><Copy className="w-4 h-4" /> Duplicate</motion.button>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={(e) => handleArchiveNote(selectedNote.id, e)} className={`flex items-center gap-1.5 px-3 py-2 text-sm ${t.meta} ${t.btnHover} rounded-xl`}><Archive className="w-4 h-4" /> {selectedNote.isArchived ? 'Unarchive' : 'Archive'}</motion.button>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={(e) => handleDeleteNote(selectedNote.id, e)} className={`flex items-center gap-1.5 px-3 py-2 text-sm text-rose-500 hover:bg-rose-500/10 rounded-xl`}><Trash2 className="w-4 h-4" /> Delete</motion.button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}