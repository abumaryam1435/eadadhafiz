import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Folder, 
  FolderPlus, 
  FolderOpen, 
  Upload, 
  Video, 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Download, 
  Share2, 
  Trash2, 
  Edit3, 
  Eye, 
  Search, 
  Filter, 
  Plus, 
  X, 
  Check, 
  ExternalLink, 
  FileSpreadsheet, 
  Copy, 
  Maximize2, 
  File as FileGenericIcon, 
  HardDrive, 
  Play, 
  Calendar, 
  Sparkles,
  RefreshCw,
  Info,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { DocumentCategory, SupervisorDocument } from '../types';
import { 
  getAllCategories, 
  saveCategory, 
  deleteCategory, 
  getAllDocuments, 
  saveDocument, 
  getDocumentBlob, 
  deleteDocument, 
  updateDocumentMeta, 
  formatFileSize, 
  getFileCategoryIcon,
  downloadDocument,
  shareDocument,
  DEFAULT_CATEGORIES 
} from '../utils/documentsStorage';

export const DocumentsManager: React.FC = () => {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<SupervisorDocument[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'pdf' | 'video' | 'audio' | 'other'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  // Modals state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DocumentCategory | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryColorInput, setCategoryColorInput] = useState('#059669');
  const [categoryDescInput, setCategoryDescInput] = useState('');

  // Document Edit Modal
  const [editingDoc, setEditingDoc] = useState<SupervisorDocument | null>(null);
  const [docTitleInput, setDocTitleInput] = useState('');
  const [docCategoryInput, setDocCategoryInput] = useState('');
  const [docNotesInput, setDocNotesInput] = useState('');

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<SupervisorDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Delete Confirm Modal
  const [deletingDoc, setDeletingDoc] = useState<SupervisorDocument | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<DocumentCategory | null>(null);

  // File Inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Color options for categories
  const PRESET_COLORS = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#4b5563', '#16a34a'];

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cats, docs] = await Promise.all([
        getAllCategories(),
        getAllDocuments()
      ]);
      setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Total size calculated
  const totalStorageBytes = useMemo(() => {
    return documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
  }, [documents]);

  // Handle files upload
  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const targetCategory = selectedCategoryId !== 'all' 
      ? selectedCategoryId 
      : (categories[0]?.id || 'cat-general');
    
    const targetCatObj = categories.find(c => c.id === targetCategory);
    const catName = targetCatObj ? targetCatObj.name : 'عام';

    let count = 0;
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgressText(`جاري حفظ الملف ${i + 1} من ${total}: ${file.name}`);
      try {
        await saveDocument(file, {
          title: file.name.replace(/\.[^/.]+$/, ''),
          categoryId: targetCategory,
          categoryName: catName,
        });
        count++;
      } catch (e) {
        console.error('Error saving document:', file.name, e);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setUploadProgressText('');
    setIsUploading(false);
    await loadData();
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesUpload(e.dataTransfer.files);
    }
  };

  // Preview Document
  const handleOpenPreview = async (doc: SupervisorDocument) => {
    setPreviewDoc(doc);
    setIsLoadingPreview(true);
    setPreviewBlobUrl(null);

    try {
      let blob = await getDocumentBlob(doc.blobKey);
      if (!blob && doc.storageUrl) {
        const res = await fetch(doc.storageUrl);
        blob = await res.blob();
      }
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
      }
    } catch (err) {
      console.error('Failed to load blob for preview:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const closePreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl(null);
    setPreviewDoc(null);
  };

  // Save Category
  const handleSaveCategory = async () => {
    if (!categoryNameInput.trim()) return;

    const catToSave: DocumentCategory = {
      id: editingCategory ? editingCategory.id : `cat_${Date.now()}`,
      name: categoryNameInput.trim(),
      color: categoryColorInput,
      description: categoryDescInput.trim(),
      createdAt: editingCategory ? editingCategory.createdAt : Date.now(),
    };

    await saveCategory(catToSave);
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryNameInput('');
    setCategoryDescInput('');
    await loadData();
  };

  // Open Edit Category
  const openEditCategory = (cat: DocumentCategory, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCategory(cat);
    setCategoryNameInput(cat.name);
    setCategoryColorInput(cat.color || '#059669');
    setCategoryDescInput(cat.description || '');
    setShowCategoryModal(true);
  };

  // Delete Category
  const confirmDeleteCategory = async (deleteFiles: boolean) => {
    if (!deletingCategory) return;
    await deleteCategory(deletingCategory.id, deleteFiles);
    setDeletingCategory(null);
    if (selectedCategoryId === deletingCategory.id) {
      setSelectedCategoryId('all');
    }
    await loadData();
  };

  // Edit Document Metadata
  const openEditDoc = (doc: SupervisorDocument) => {
    setEditingDoc(doc);
    setDocTitleInput(doc.title);
    setDocCategoryInput(doc.categoryId);
    setDocNotesInput(doc.notes || '');
  };

  const handleSaveDocEdit = async () => {
    if (!editingDoc) return;
    const cat = categories.find(c => c.id === docCategoryInput);
    await updateDocumentMeta(editingDoc.id, {
      title: docTitleInput.trim() || editingDoc.title,
      categoryId: docCategoryInput,
      categoryName: cat?.name || editingDoc.categoryName,
      notes: docNotesInput.trim(),
    });
    setEditingDoc(null);
    await loadData();
  };

  // Confirm Delete Document
  const handleConfirmDeleteDoc = async () => {
    if (!deletingDoc) return;
    await deleteDocument(deletingDoc.id);
    setDeletingDoc(null);
    if (previewDoc?.id === deletingDoc.id) {
      closePreview();
    }
    await loadData();
  };

  // Filtered and Sorted Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Category match
      if (selectedCategoryId !== 'all' && doc.categoryId !== selectedCategoryId) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all') {
        const catIcon = getFileCategoryIcon(doc.fileType);
        if (typeFilter === 'image' && catIcon !== 'image') return false;
        if (typeFilter === 'pdf' && catIcon !== 'pdf') return false;
        if (typeFilter === 'video' && catIcon !== 'video') return false;
        if (typeFilter === 'audio' && catIcon !== 'audio') return false;
        if (typeFilter === 'other' && (catIcon === 'image' || catIcon === 'pdf' || catIcon === 'video' || catIcon === 'audio')) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = doc.title.toLowerCase().includes(q);
        const matchesFileName = doc.fileName.toLowerCase().includes(q);
        const matchesNotes = doc.notes?.toLowerCase().includes(q);
        const matchesCategory = doc.categoryName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesFileName && !matchesNotes && !matchesCategory) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt - a.createdAt;
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'name') return a.title.localeCompare(b.title, 'ar');
      if (sortBy === 'size') return b.fileSize - a.fileSize;
      return 0;
    });
  }, [documents, selectedCategoryId, typeFilter, searchQuery, sortBy]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(doc => {
      counts[doc.categoryId] = (counts[doc.categoryId] || 0) + 1;
    });
    return counts;
  }, [documents]);

  return (
    <div 
      className="space-y-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => e.target.files && handleFilesUpload(e.target.files)} 
        multiple 
        className="hidden" 
      />

      {/* Main Top Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        {/* Background decorative pattern */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl">
                <FolderOpen className="w-6 h-6 text-emerald-200" />
              </span>
              <h2 className="text-2xl font-black tracking-tight">أرشيف ومستندات المشرف</h2>
            </div>
            <p className="text-emerald-100 text-sm font-medium">
              حفظ وتبويب المستندات والتعاميم والملفات المصورة والمرئية والرجوع إليها ومشاركتها في أي وقت
            </p>
            <div className="flex items-center gap-4 pt-2 text-xs font-bold text-emerald-200">
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full">
                <FileGenericIcon className="w-3.5 h-3.5" />
                {documents.length} ملف مخزن
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full">
                <HardDrive className="w-3.5 h-3.5" />
                الحجم الكلي: {formatFileSize(totalStorageBytes)}
              </span>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Upload Any Files */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-black rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>رفع ملفات ومستندات</span>
            </button>

            {/* New Category Button */}
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryNameInput('');
                setCategoryColorInput('#059669');
                setCategoryDescInput('');
                setShowCategoryModal(true);
              }}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-950/60 hover:bg-emerald-950 text-emerald-100 hover:text-white font-black rounded-xl shadow-sm transition-all active:scale-95 text-xs border border-emerald-400/30 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-emerald-300" />
              <span>إضافة قسم</span>
            </button>
          </div>
        </div>

        {/* Upload Progress Bar if uploading */}
        {isUploading && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
            <span className="text-xs font-bold text-white">{uploadProgressText || 'جاري حفظ الملفات في قاعدة البرنامج...'}</span>
          </div>
        )}
      </div>

      {/* Drag & Drop Visual Cue */}
      {isDragOver && (
        <div className="p-8 border-3 border-dashed border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-3xl text-center animate-bounce">
          <Upload className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <p className="text-lg font-black text-emerald-800 dark:text-emerald-200">أفلت الملفات هنا لحفظها فوراً في الأرشيف!</p>
        </div>
      )}

      {/* Categories Bar (الأقسام والتبويبات) */}
      <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-black text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            أقسام المستندات والملفات:
          </span>
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryNameInput('');
              setCategoryColorInput('#059669');
              setShowCategoryModal(true);
            }}
            className="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            قسم جديد
          </button>
        </div>

        {/* Horizontal Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {/* All Documents Button */}
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-emerald-700 text-white shadow-md'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>جميع المستندات</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              selectedCategoryId === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
            }`}>
              {documents.length}
            </span>
          </button>

          {/* Individual Category Tabs */}
          {categories.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = selectedCategoryId === cat.id;

            return (
              <div 
                key={cat.id} 
                className="flex items-center group relative shrink-0"
              >
                <button
                  onClick={() => setSelectedCategoryId(cat.id)}
                  style={{
                    backgroundColor: isSelected ? (cat.color || '#059669') : undefined,
                    borderColor: cat.color || '#059669'
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                    isSelected
                      ? 'text-white shadow-md'
                      : 'bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: isSelected ? '#ffffff' : (cat.color || '#059669') }}
                  />
                  <span>{cat.name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    {count}
                  </span>
                </button>

                {/* Edit Category quick icon on hover / active */}
                <button
                  onClick={(e) => openEditCategory(cat, e)}
                  className="mr-1 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity"
                  title="تعديل هذا القسم"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الملف أو المحتوى..."
              className="w-full pr-10 pl-4 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-emerald-600 dark:focus:border-emerald-500 font-bold text-gray-800 dark:text-gray-100"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-black'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setTypeFilter('image')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                typeFilter === 'image'
                  ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 font-black'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ImageIcon className="w-3 h-3 text-purple-600" />
              صور
            </button>
            <button
              onClick={() => setTypeFilter('pdf')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                typeFilter === 'pdf'
                  ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 font-black'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FileText className="w-3 h-3 text-red-600" />
              ملفات PDF
            </button>
            <button
              onClick={() => setTypeFilter('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                typeFilter === 'video'
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 font-black'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Video className="w-3 h-3 text-rose-600" />
              فيديو
            </button>
            <button
              onClick={() => setTypeFilter('audio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                typeFilter === 'audio'
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-black'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Music className="w-3 h-3 text-amber-600" />
              صوت
            </button>
            <button
              onClick={() => setTypeFilter('other')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === 'other'
                  ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 font-black'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              أخرى
            </button>
          </div>

          {/* Sort & View Mode */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-gray-700 dark:text-gray-200 outline-none cursor-pointer font-bold"
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
                <option value="name">حسب الاسم (أ-ي)</option>
                <option value="size">حسب الحجم (الأكبر)</option>
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white dark:bg-gray-800 text-emerald-700 shadow-sm' : 'text-gray-500'
                }`}
                title="عرض شبكي"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-white dark:bg-gray-800 text-emerald-700 shadow-sm' : 'text-gray-500'
                }`}
                title="عرض قائمة"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Documents Content */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">جاري تحميل المستندات والملفات من قاعدة البرنامج...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 space-y-4">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">لا توجد ملفات في هذا القسم حالياً</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              يمكنك البدء برفع المستندات والملفات أو سحبها وإفلاتها هنا مباشرة.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>رفع ملفات الآن</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDocuments.map((doc) => {
            const catIcon = getFileCategoryIcon(doc.fileType);
            const categoryObj = categories.find(c => c.id === doc.categoryId);

            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-emerald-500/50"
              >
                {/* Visual Preview Header */}
                <div 
                  onClick={() => handleOpenPreview(doc)}
                  className="relative h-36 bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden cursor-pointer group-hover:opacity-95 transition-opacity"
                >
                  {doc.thumbnail ? (
                    <img 
                      src={doc.thumbnail} 
                      alt={doc.title} 
                      className="w-full h-full object-cover" 
                    />
                  ) : catIcon === 'pdf' ? (
                    <div className="flex flex-col items-center gap-1 text-red-500">
                      <FileText className="w-12 h-12 stroke-1" />
                      <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded">PDF</span>
                    </div>
                  ) : catIcon === 'video' ? (
                    <div className="flex flex-col items-center gap-1 text-rose-500">
                      <Video className="w-12 h-12 stroke-1" />
                      <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded">فيديو</span>
                    </div>
                  ) : catIcon === 'audio' ? (
                    <div className="flex flex-col items-center gap-1 text-amber-500">
                      <Music className="w-12 h-12 stroke-1" />
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded">صوت</span>
                    </div>
                  ) : catIcon === 'spreadsheet' ? (
                    <div className="flex flex-col items-center gap-1 text-emerald-600">
                      <FileSpreadsheet className="w-12 h-12 stroke-1" />
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded">جدول أكسل</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <FileGenericIcon className="w-12 h-12 stroke-1" />
                      <span className="text-[10px] font-black uppercase tracking-wider bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">ملف</span>
                    </div>
                  )}

                  {/* Play Overlay if video */}
                  {catIcon === 'video' && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 text-rose-600 fill-rose-600 mr-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Quick Preview Eye Overlay on Hover */}
                  <div className="absolute inset-0 bg-emerald-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-3 py-1.5 bg-white text-emerald-900 rounded-xl text-xs font-black flex items-center gap-1 shadow-lg">
                      <Eye className="w-3.5 h-3.5" />
                      معاينة
                    </span>
                  </div>

                  {/* Size Badge */}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white rounded-md text-[10px] font-bold">
                    {formatFileSize(doc.fileSize)}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Category Tag */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span 
                        style={{ backgroundColor: `${categoryObj?.color || '#059669'}15`, color: categoryObj?.color || '#059669' }}
                        className="text-[10px] font-black px-2 py-0.5 rounded-md"
                      >
                        {doc.categoryName || categoryObj?.name || 'عام'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 
                      onClick={() => handleOpenPreview(doc)}
                      className="font-black text-sm text-gray-800 dark:text-gray-100 line-clamp-1 hover:text-emerald-600 cursor-pointer"
                      title={doc.title}
                    >
                      {doc.title}
                    </h4>

                    {/* Original filename & notes */}
                    <p className="text-[11px] text-gray-400 line-clamp-1 font-mono dir-ltr text-right" title={doc.fileName}>
                      {doc.fileName}
                    </p>
                    {doc.notes && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                        {doc.notes}
                      </p>
                    )}
                  </div>

                  {/* Card Actions Toolbar */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {/* Download */}
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                        title="تحميل الملف"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Share */}
                      <button
                        onClick={() => shareDocument(doc)}
                        className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                        title="مشاركة عبر التواصل"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => openEditDoc(doc)}
                        className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                        title="تعديل العنوان أو القسم أو الملاحظات"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => setDeletingDoc(doc)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                      title="حذف الملف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-black border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="p-3">الملف / العنوان</th>
                  <th className="p-3">القسم</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">الحجم</th>
                  <th className="p-3">تاريخ الإضافة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-bold">
                {filteredDocuments.map((doc) => {
                  const categoryObj = categories.find(c => c.id === doc.categoryId);
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <button 
                            onClick={() => handleOpenPreview(doc)}
                            className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 rounded-xl hover:bg-emerald-100 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <div>
                            <div 
                              onClick={() => handleOpenPreview(doc)}
                              className="font-black text-gray-800 dark:text-gray-100 hover:text-emerald-600 cursor-pointer text-sm"
                            >
                              {doc.title}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono dir-ltr">{doc.fileName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span 
                          style={{ backgroundColor: `${categoryObj?.color || '#059669'}15`, color: categoryObj?.color || '#059669' }}
                          className="px-2.5 py-1 rounded-md text-xs font-black"
                        >
                          {doc.categoryName || categoryObj?.name || 'عام'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                        {doc.fileType.split('/')[1] || doc.fileType}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-300 font-bold">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => downloadDocument(doc)}
                            className="p-1.5 text-gray-600 hover:text-emerald-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                            title="تحميل"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => shareDocument(doc)}
                            className="p-1.5 text-gray-600 hover:text-emerald-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                            title="مشاركة"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditDoc(doc)}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingDoc(doc)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Category Create/Edit */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-600" />
                {editingCategory ? 'تعديل بيانات القسم' : 'إضافة قسم جديد للمستندات'}
              </h3>
              <button 
                onClick={() => setShowCategoryModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-right">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  اسم القسم <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={categoryNameInput} 
                  onChange={(e) => setCategoryNameInput(e.target.value)}
                  placeholder="مثال: التعاميم الإدارية، الخطط التشغيلية..." 
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:border-emerald-600 font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  لون تمييز القسم
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryColorInput(c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        categoryColorInput === c ? 'scale-125 ring-2 ring-offset-2 ring-emerald-600' : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                  <input 
                    type="color" 
                    value={categoryColorInput} 
                    onChange={(e) => setCategoryColorInput(e.target.value)}
                    className="w-8 h-8 rounded-full border-0 cursor-pointer"
                    title="اختر لوناً مخصصاً"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  وصف مختصر (اختياري)
                </label>
                <textarea
                  value={categoryDescInput}
                  onChange={(e) => setCategoryDescInput(e.target.value)}
                  placeholder="وصف مختصر لمحتويات هذا القسم..."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:border-emerald-600 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleSaveCategory}
                disabled={!categoryNameInput.trim()}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
              >
                {editingCategory ? 'حفظ التعديلات' : 'إنشاء القسم'}
              </button>
              {editingCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setDeletingCategory(editingCategory);
                  }}
                  className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-black cursor-pointer"
                >
                  حذف القسم
                </button>
              )}
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Document Edit Metadata */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                تعديل بيانات المستند
              </h3>
              <button 
                onClick={() => setEditingDoc(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-right">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  عنوان المستند / الملف <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={docTitleInput} 
                  onChange={(e) => setDocTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:border-emerald-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  القسم التابع له
                </label>
                <select
                  value={docCategoryInput}
                  onChange={(e) => setDocCategoryInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:border-emerald-600 font-bold cursor-pointer"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  ملاحظات إضافية
                </label>
                <textarea
                  value={docNotesInput}
                  onChange={(e) => setDocNotesInput(e.target.value)}
                  placeholder="ملاحظات حول الملف، الجهة المصدرة، التاريخ..."
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:border-emerald-600 font-bold"
                />
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs space-y-1 font-mono text-gray-500">
                <div>اسم الملف الأصلي: {editingDoc.fileName}</div>
                <div>الحجم: {formatFileSize(editingDoc.fileSize)}</div>
                <div>الصيغة: {editingDoc.fileType}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleSaveDocEdit}
                disabled={!docTitleInput.trim()}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
              >
                حفظ التعديلات
              </button>
              <button
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Document Full Preview */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-2 sm:p-6 overflow-hidden">
          {/* Header Bar */}
          <div className="bg-gray-900/90 text-white rounded-2xl px-4 py-3 flex items-center justify-between gap-4 mb-3 border border-white/10 shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="p-2 bg-emerald-700 rounded-xl">
                <FileGenericIcon className="w-5 h-5 text-white" />
              </span>
              <div className="truncate">
                <h3 className="font-black text-sm sm:text-base truncate">{previewDoc.title}</h3>
                <span className="text-xs text-gray-400 font-bold">
                  {previewDoc.categoryName || 'عام'} • {formatFileSize(previewDoc.fileSize)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => downloadDocument(previewDoc)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">تحميل</span>
              </button>

              <button
                onClick={() => shareDocument(previewDoc)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">مشاركة</span>
              </button>

              <button
                onClick={closePreview}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
                title="إغلاق المعاينة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Preview Container */}
          <div className="flex-1 bg-gray-950/60 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden p-2 relative">
            {isLoadingPreview ? (
              <div className="text-center text-white space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
                <p className="text-sm font-bold">جاري تجهيز المعاينة من قاعدة البرنامج...</p>
              </div>
            ) : previewBlobUrl ? (
              previewDoc.fileType.startsWith('image/') ? (
                /* Image Preview */
                <img 
                  src={previewBlobUrl} 
                  alt={previewDoc.title} 
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" 
                />
              ) : previewDoc.fileType.startsWith('video/') ? (
                /* Video Player */
                <video 
                  src={previewBlobUrl} 
                  controls 
                  autoPlay 
                  playsInline
                  className="max-h-full max-w-full rounded-lg shadow-2xl"
                />
              ) : previewDoc.fileType.startsWith('audio/') ? (
                /* Audio Player */
                <div className="bg-gray-900 p-8 rounded-3xl border border-white/10 text-center space-y-4 max-w-md w-full">
                  <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                    <Music className="w-10 h-10" />
                  </div>
                  <h4 className="text-lg font-black text-white">{previewDoc.title}</h4>
                  <audio src={previewBlobUrl} controls autoPlay className="w-full" />
                </div>
              ) : previewDoc.fileType.includes('pdf') ? (
                /* PDF Viewer */
                <iframe 
                  src={previewBlobUrl} 
                  title={previewDoc.title}
                  className="w-full h-full rounded-lg bg-white" 
                />
              ) : (
                /* Other file formats */
                <div className="bg-gray-900 p-8 rounded-3xl border border-white/10 text-center space-y-4 max-w-md">
                  <FileGenericIcon className="w-16 h-16 text-emerald-400 mx-auto" />
                  <h4 className="text-lg font-black text-white">{previewDoc.title}</h4>
                  <p className="text-xs text-gray-400">
                    هذه الصيغة ({previewDoc.fileType}) يمكن تحميلها وفتحها بالتطبيق المناسب على جهازك.
                  </p>
                  <button
                    onClick={() => downloadDocument(previewDoc)}
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-xl shadow-lg transition-all text-sm inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل الملف وفتحه</span>
                  </button>
                </div>
              )
            ) : (
              <div className="text-center text-white space-y-3">
                <Info className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-sm font-bold">تعذر تحميل المعاينة المباشرة.</p>
                <button
                  onClick={() => downloadDocument(previewDoc)}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-black"
                >
                  تحميل الملف مباشرة
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Document Confirmation */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 border border-gray-100 dark:border-gray-700">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-950/60 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">تأكيد حذف المستند</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-bold">
                هل أنت متأكد من رغبتك في حذف الملف &quot;{deletingDoc.title}&quot; نهائياً من قاعدة البرنامج؟
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDeleteDoc}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                نعم، احذف الملف
              </button>
              <button
                onClick={() => setDeletingDoc(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Delete Category Confirmation */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-4 border border-gray-100 dark:border-gray-700">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-950/60 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">حذف قسم &quot;{deletingCategory.name}&quot;</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-bold">
                ماذا ترغب أن تفعل بالملفات الموجودة داخل هذا القسم ({categoryCounts[deletingCategory.id] || 0} ملف)؟
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => confirmDeleteCategory(false)}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs transition-all shadow-sm cursor-pointer"
              >
                نقل الملفات إلى &quot;ملفات عامة&quot; وحذف القسم فقط
              </button>
              <button
                onClick={() => confirmDeleteCategory(true)}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs transition-all shadow-sm cursor-pointer"
              >
                حذف القسم وجميع الملفات التابعة له
              </button>
              <button
                onClick={() => setDeletingCategory(null)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsManager;
