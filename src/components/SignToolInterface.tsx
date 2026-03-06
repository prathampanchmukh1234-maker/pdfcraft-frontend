import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import axios from 'axios';
import { Session } from '@supabase/supabase-js';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  Plus, 
  PenTool, 
  Award, 
  GripVertical, 
  Type, 
  Edit2, 
  ArrowRight,
  X,
  FileText,
  Trash2,
  Loader2,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignToolInterfaceProps {
  file: File;
  session: Session;
  onSign: (fields: PlacedField[], signatureFile: File | null) => void;
  onChangeFile: () => void;
  loading: boolean;
  resultUrl?: string | null;
  toolId?: string;
}

export interface PlacedField {
  id: string;
  type: 'signature' | 'initials' | 'name' | 'text';
  x: number;
  y: number;
  scale: number;
  pageNumber: number;
  content: string;
  color?: string;
}

type SignatureColor = 'black' | 'red' | 'blue' | 'green';

const SIGNATURE_PRESETS = [
  { id: 'preset-1', fontFamily: '"Brush Script MT", "Segoe Script", cursive' },
  { id: 'preset-2', fontFamily: '"Lucida Handwriting", cursive' },
  { id: 'preset-3', fontFamily: '"Comic Sans MS", "Segoe UI", cursive' },
  { id: 'preset-4', fontFamily: '"Bradley Hand", "Segoe Script", cursive' },
];

export default function SignToolInterface({ file, session, onSign, onChangeFile, loading, resultUrl, toolId = 'sign' }: SignToolInterfaceProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'simple' | 'digital'>('simple');
  const [showTooltip, setShowTooltip] = useState(true);
  const [signatureName, setSignatureName] = useState('PrathamPanchmukh');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureModalTab, setSignatureModalTab] = useState<'signature' | 'initials' | 'stamp'>('signature');
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [localResultUrl, setLocalResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [fullName, setFullName] = useState('PrathamPanchmukh');
  const [initials, setInitials] = useState('PP');
  const [signaturePreset, setSignaturePreset] = useState(SIGNATURE_PRESETS[0].id);
  const [signatureColor, setSignatureColor] = useState<SignatureColor>('black');
  
  const constraintsRef = useRef<HTMLDivElement>(null);

  const signatureFontFamily = SIGNATURE_PRESETS.find((p) => p.id === signaturePreset)?.fontFamily || SIGNATURE_PRESETS[0].fontFamily;

  const getPdfColor = (color?: string) => {
    if (color === 'blue') return rgb(0, 0, 1);
    if (color === 'red') return rgb(1, 0, 0);
    if (color === 'green') return rgb(0, 0.6, 0);
    return rgb(0, 0, 0);
  };

  const getTextColorClass = (color?: string) => {
    if (color === 'blue') return 'text-blue-600';
    if (color === 'red') return 'text-red-600';
    if (color === 'green') return 'text-green-600';
    return 'text-slate-800';
  };

  const applySignatureDetails = () => {
    const safeName = fullName.trim() || signatureName;
    const safeInitials = initials.trim().slice(0, 3).toUpperCase() || 'PP';
    setSignatureName(safeName);
    setInitials(safeInitials);
    setPlacedFields(fields => fields.map(f => {
      if (f.type === 'signature') {
        return { ...f, content: safeName, color: signatureColor };
      }
      if (f.type === 'initials') {
        return { ...f, content: safeInitials, color: signatureColor };
      }
      return f;
    }));
    setShowSignatureModal(false);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSignatureFile(e.target.files[0]);
    }
  };

  const handleClientSign = async () => {
    if (placedFields.length === 0) return;
    setIsProcessing(true);
    setUploadWarning(null);
    console.log("Starting client-side signing with", placedFields.length, "fields");
    try {
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      console.log("PDF loaded with", pages.length, "pages");
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const field of placedFields) {
        const pageIndex = field.pageNumber - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) {
          console.warn("Skipping field on invalid page:", field.pageNumber);
          continue;
        }
        
        const targetPage = pages[pageIndex];
        const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();
        const screenWidth = 800; // Match frontend width
        const scaleFactor = pdfWidth / screenWidth;

        console.log(`Processing field: ${field.type} at (${field.x}, ${field.y}) on page ${field.pageNumber}`);

        if (field.type === 'signature' && signatureFile) {
          try {
            const signatureImageBytes = await signatureFile.arrayBuffer();
            let signatureImage;
            if (signatureFile.type === 'image/png') {
              signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            } else {
              signatureImage = await pdfDoc.embedJpg(signatureImageBytes);
            }

            const fieldScale = (field.scale || 1);
            // Adjust image scaling to match visual representation
            const { width: imgWidth, height: imgHeight } = signatureImage.scale(fieldScale * scaleFactor * 0.4);
            
            const pdfX = field.x * scaleFactor;
            const pdfY = pdfHeight - (field.y * scaleFactor) - imgHeight;
            
            targetPage.drawImage(signatureImage, {
              x: pdfX,
              y: pdfY,
              width: imgWidth,
              height: imgHeight,
            });
          } catch (imgError) {
            console.error("Error embedding signature image:", imgError);
            // Fallback to text
            const fontSize = 20 * field.scale * scaleFactor;
            const pdfX = field.x * scaleFactor;
            const pdfY = pdfHeight - (field.y * scaleFactor) - fontSize;
            targetPage.drawText(field.content || signatureName, {
              x: pdfX,
              y: pdfY,
              size: fontSize,
              font: font,
              color: getPdfColor(field.color || signatureColor),
            });
          }
        } else {
          const fontSize = (field.type === 'initials' ? 24 : (field.type === 'text' ? 14 : 14)) * field.scale * scaleFactor;
          const pdfX = field.x * scaleFactor;
          const pdfY = pdfHeight - (field.y * scaleFactor) - fontSize;
          
          const color = getPdfColor(field.color);
          
          targetPage.drawText(field.content || " ", {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font: font,
            color: color,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const localBlobUrl = URL.createObjectURL(blob);
      setResultBlob(blob);
      setLocalResultUrl(localBlobUrl);
      
      // Upload to backend for history tracking
      const formData = new FormData();
      formData.append('file', blob, `processed_${file.name}`);
      formData.append('operationType', toolId);
      formData.append('originalName', file.name);
      try {
        const response = await axios.post('/api/upload-processed', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        setLocalResultUrl(response.data.url || localBlobUrl);
      } catch (uploadError) {
        console.error("Upload after signing failed:", uploadError);
        const err = uploadError as any;
        const serverMessage = err?.response?.data?.error;
        setUploadWarning(serverMessage || "PDF signed locally. Cloud save failed, but you can still download.");
      }
    } catch (error) {
      console.error("Signing error:", error);
      alert("Failed to sign PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!localResultUrl) return;
    
    try {
      let blobToDownload: Blob;
      
      if (resultBlob) {
        blobToDownload = resultBlob;
      } else {
        // Fallback for when we only have the URL (e.g. from history or if blob was lost)
        const response = await fetch(localResultUrl);
        blobToDownload = await response.blob();
      }

      const url = URL.createObjectURL(blobToDownload);
      const link = document.createElement('a');
      link.href = url;
      link.download = `signed_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Download error:", error);
      // If fetch fails (CORS), try direct link as last resort
      window.open(localResultUrl, '_blank');
    }
  };

  const addField = (type: 'signature' | 'initials' | 'name' | 'text', x = 150, y = 150) => {
    const newField: PlacedField = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x,
      y,
      scale: 1,
      pageNumber: currentPage,
      content: type === 'signature' ? signatureName : (type === 'initials' ? initials : (type === 'text' ? 'Double click to edit' : 'Name')),
      color: type === 'signature' || type === 'initials' ? signatureColor : 'black'
    };
    setPlacedFields([...placedFields, newField]);
    setSelectedFieldId(newField.id);
    setShowTooltip(false);
  };

  const updateFieldScale = (id: string, scale: number) => {
    setPlacedFields(fields => fields.map(f => f.id === id ? { ...f, scale } : f));
  };

  const removeField = (id: string) => {
    setPlacedFields(placedFields.filter(f => f.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, type: 'signature' | 'initials' | 'name' | 'text') => {
    e.dataTransfer.setData('fieldType', type);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const type = e.dataTransfer.getData('fieldType') as 'signature' | 'initials' | 'name' | 'text';
    if (!type) return;

    const rect = constraintsRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left - 60;
      const y = e.clientY - rect.top - 30;
      addField(type, x, y);
    }
  };

  return (
    <div className="fixed inset-0 top-16 bg-[#f4f4f4] flex flex-col z-40">
      {/* Secondary Toolbar */}
      <div className="h-12 bg-white border-b border-slate-200 flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(numPages || 1, prev + 1))}
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 ml-2">
              <input 
                type="text" 
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value) || 1)}
                className="w-10 h-7 border border-slate-300 rounded text-center text-sm font-medium focus:border-[#e5322d] outline-none"
              />
              <span className="text-sm text-slate-500">/ {numPages || '?'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div 
              onClick={onChangeFile}
              className="px-3 py-1 bg-slate-100 rounded border border-slate-200 flex items-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors"
            >
              <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{file.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Thumbnails */}
        <div className="w-48 bg-white border-r border-slate-200 overflow-y-auto p-4 space-y-4 hidden md:block">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>}
          >
            {Array.from({ length: numPages || 0 }).map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "relative cursor-pointer group transition-all mb-4",
                  currentPage === i + 1 ? "ring-2 ring-[#e5322d]" : "hover:ring-2 hover:ring-slate-300"
                )}
                onClick={() => setCurrentPage(i + 1)}
              >
                <div className="aspect-[3/4] bg-white border border-slate-200 shadow-sm rounded overflow-hidden">
                  <Page 
                    pageNumber={i + 1} 
                    width={140} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                  />
                </div>
                <span className="block text-center text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                  {i + 1}
                </span>
              </div>
            ))}
          </Document>
        </div>

        {/* Main Content - PDF Viewer */}
        <div className="flex-1 overflow-auto p-8 flex justify-center relative bg-[#e0e0e0]" onClick={() => setSelectedFieldId(null)}>
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="flex justify-center py-20 min-h-[800px] items-center bg-white w-full"><Loader2 className="w-10 h-10 animate-spin text-red-600" /></div>}
          >
            <div 
              ref={constraintsRef}
              className="relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
            >
              <Page 
                pageNumber={currentPage} 
                width={800}
                onLoadSuccess={(page) => setPageWidth(page.width)}
                className="shadow-inner"
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              
              {/* Placed Fields */}
              <div className="absolute inset-0 pointer-events-none">
                {placedFields.filter(f => f.pageNumber === currentPage).map((field) => (
                  <motion.div
                    key={field.id}
                    drag
                    dragConstraints={constraintsRef}
                    dragMomentum={false}
                    dragElastic={0}
                    dragSnapToOrigin
                    onMouseDown={() => setSelectedFieldId(field.id)}
                    onDragEnd={(_, info) => {
                      const container = constraintsRef.current;
                      if (!container) return;

                      const maxX = Math.max(0, container.clientWidth - 120);
                      const maxY = Math.max(0, container.clientHeight - 40);
                      const nextX = Math.max(0, Math.min(field.x + info.offset.x, maxX));
                      const nextY = Math.max(0, Math.min(field.y + info.offset.y, maxY));

                      setPlacedFields(fields => fields.map(f => f.id === field.id ? {
                        ...f,
                        x: nextX,
                        y: nextY
                      } : f));
                    }}
                    style={{ 
                      left: field.x, 
                      top: field.y,
                      scale: field.scale,
                      transformOrigin: 'top left',
                      position: 'absolute'
                    }}
                    className={cn(
                      "z-30 p-3 rounded-lg border-2 border-dashed cursor-grab active:cursor-grabbing group min-w-[150px] pointer-events-auto transition-shadow",
                      selectedFieldId === field.id ? "ring-2 ring-red-500 ring-offset-2" : "",
                      field.type === 'signature' ? "border-blue-400 bg-blue-50/80 shadow-sm" : 
                      (field.type === 'initials' ? "border-purple-400 bg-purple-50/80 shadow-sm" : "border-slate-400 bg-slate-50/80 shadow-sm")
                    )}
                  >
                    <div className="relative">
                      <div className="absolute -top-10 -right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-lg shadow-md border border-slate-200">
                        {field.type === 'text' && (
                          <div className="flex gap-1 mr-1 border-r border-slate-200 pr-1">
                            {['black', 'blue', 'red'].map(c => (
                              <button
                                key={c}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlacedFields(fields => fields.map(f => f.id === field.id ? { ...f, color: c } : f));
                                }}
                                className={cn(
                                  "w-4 h-4 rounded-full border border-slate-200",
                                  c === 'black' ? "bg-black" : (c === 'blue' ? "bg-blue-600" : "bg-red-600"),
                                  field.color === c ? "ring-2 ring-offset-1 ring-slate-400" : ""
                                )}
                              />
                            ))}
                          </div>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFieldScale(field.id, Math.max(0.2, field.scale - 0.1));
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFieldScale(field.id, Math.min(3, field.scale + 0.1));
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-slate-200 mx-1 self-center" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(field.id);
                          }}
                          className="p-1 hover:bg-red-50 rounded text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-[8px] font-bold uppercase",
                          field.type === 'signature' ? "text-blue-600" : 
                          (field.type === 'initials' ? "text-purple-600" : (field.type === 'text' ? "text-emerald-600" : "text-slate-600"))
                        )}>
                          {field.type}
                        </span>
                        {field.type === 'text' ? (
                          <input 
                            type="text"
                            value={field.content}
                            onChange={(e) => {
                              setPlacedFields(fields => fields.map(f => f.id === field.id ? { ...f, content: e.target.value } : f));
                            }}
                            className="bg-transparent border-none outline-none font-sans text-sm w-full"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className={cn(
                            "font-serif italic",
                            field.type === 'signature' ? "text-lg" : 
                            (field.type === 'initials' ? "text-2xl" : "text-sm"),
                            getTextColorClass(field.color)
                          )}>
                            <span style={field.type === 'signature' ? { fontFamily: signatureFontFamily } : undefined}>
                              {field.type === 'signature' ? signatureName : field.content}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Document>

          <div className="absolute top-8 right-8 z-40">
            <div className="relative">
              <div 
                onClick={() => addField('signature')}
                className="w-10 h-10 bg-[#e5322d] rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer hover:bg-[#d42d28] transition-colors"
              >
                <Plus className="w-6 h-6" />
              </div>
              {placedFields.length > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white">
                  {placedFields.length}
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showTooltip && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <div className="bg-[#ffe8a1] px-6 py-8 rounded-lg shadow-xl border border-[#e6d08a] relative max-w-[300px] text-center">
                  <button 
                    onClick={() => setShowTooltip(false)}
                    className="absolute top-2 right-2 p-1 hover:bg-black/5 rounded"
                  >
                    <X className="w-4 h-4 text-slate-600" />
                  </button>
                  <p className="text-slate-800 font-medium leading-tight">
                    Click the fields in the sidebar to add them to the document, then drag to position.
                  </p>
                  <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[10px] border-l-[#ffe8a1]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar - Signing Options */}
        <div className="w-[350px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-10">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-2xl font-black text-slate-800 text-center">Signing options</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-3">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Type</span>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setActiveTab('simple')}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2",
                    activeTab === 'simple' 
                      ? "border-[#e5322d] bg-red-50/30 text-[#e5322d]" 
                      : "border-slate-100 hover:border-slate-200 text-slate-400"
                  )}
                >
                  <PenTool className="w-8 h-8" />
                  <span className="text-xs font-bold">Simple Signature</span>
                </button>
                <button 
                  onClick={() => setActiveTab('digital')}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 relative",
                    activeTab === 'digital' 
                      ? "border-[#e5322d] bg-red-50/30 text-[#e5322d]" 
                      : "border-slate-100 hover:border-slate-200 text-slate-400"
                  )}
                >
                  <div className="absolute top-2 right-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                  </div>
                  <Award className="w-8 h-8" />
                  <span className="text-xs font-bold">Digital Signature</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Signature Image</span>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleSignatureFileChange}
                  className="hidden"
                  id="signature-upload"
                />
                <label 
                  htmlFor="signature-upload"
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  {signatureFile ? (
                    <div className="text-center">
                      <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <span className="text-xs font-medium text-slate-600 truncate block max-w-[200px]">{signatureFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <span className="text-xs font-medium text-slate-500">Upload PNG/JPG</span>
                    </div>
                  )}
                </label>
                {signatureFile && (
                  <button 
                    onClick={() => setSignatureFile(null)}
                    className="w-full py-1 text-[10px] font-bold text-red-500 uppercase hover:text-red-600"
                  >
                    Remove Image
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Required fields</span>
                <button
                  onClick={() => {
                    setSignatureModalTab('signature');
                    setShowSignatureModal(true);
                  }}
                  className="text-xs font-bold text-[#e5322d] hover:underline"
                >
                  Set details
                </button>
              </div>
              <div 
                draggable
                onDragStart={(e) => handleDragStart(e, 'signature')}
                onClick={() => addField('signature')}
                className="group cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-3 p-3 bg-white border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 transition-colors">
                  <div className="p-2 bg-slate-100 rounded text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="p-2 bg-blue-600 rounded text-white shadow-md">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase block">Signature</span>
                    <span
                      className={cn("text-lg tracking-wider truncate block", getTextColorClass(signatureColor))}
                      style={{ fontFamily: signatureFontFamily }}
                    >
                      {signatureName}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSignatureModal(true);
                    }}
                    className="p-2 hover:bg-slate-100 rounded text-blue-400"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Optional fields</span>
              <div className="space-y-3">
                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'initials')}
                  onClick={() => addField('initials')}
                  className="flex items-center gap-3 p-3 bg-white border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 transition-colors cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
                >
                  <div className="p-2 bg-slate-100 rounded text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="p-2 bg-blue-900 rounded text-white shadow-md">
                    <span className="text-xs font-bold">AC</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase block">Initials</span>
                    <span className={cn("text-2xl font-serif italic tracking-widest", getTextColorClass(signatureColor))}>{initials || 'PP'}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSignatureModalTab('initials');
                      setShowSignatureModal(true);
                    }}
                    className="p-2 hover:bg-slate-100 rounded text-blue-400"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'name')}
                  onClick={() => addField('name')}
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
                >
                  <div className="p-2 bg-slate-100 rounded text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="p-2 bg-slate-400 rounded text-white">
                    <Type className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-slate-400">Name</span>
                  </div>
                </div>

                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'text')}
                  onClick={() => addField('text')}
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
                >
                  <div className="p-2 bg-slate-100 rounded text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="p-2 bg-emerald-500 rounded text-white">
                    <Type className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-slate-400">Custom Text</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border-t border-slate-100">
            {(resultUrl || localResultUrl) ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
                  <Award className="w-5 h-5" />
                  <span className="text-sm font-bold">Document signed successfully!</span>
                </div>
                {uploadWarning && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm font-medium">
                    {uploadWarning}
                  </div>
                )}
                <button 
                  onClick={handleDownload}
                  className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-black text-2xl rounded-xl shadow-lg transition-all flex items-center justify-center gap-4 group active:scale-[0.98]"
                >
                  Download PDF
                  <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                >
                  Sign another document
                </button>
              </div>
            ) : (
              <button 
                onClick={handleClientSign}
                disabled={loading || isProcessing || placedFields.length === 0}
                className="w-full h-16 bg-[#f39c9c] hover:bg-[#e5322d] text-white font-black text-2xl rounded-xl shadow-lg transition-all flex items-center justify-center gap-4 group active:scale-[0.98] disabled:opacity-50"
              >
                {(loading || isProcessing) ? 'SIGNING...' : (
                  <>
                    Sign
                    <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showSignatureModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSignatureModal(false)}
          >
            <motion.div
              className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Set your signature details</h3>
                <button onClick={() => setShowSignatureModal(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Full name</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full h-11 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#e5322d]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Initials</label>
                    <input
                      value={initials}
                      maxLength={3}
                      onChange={(e) => setInitials(e.target.value.toUpperCase())}
                      className="w-full h-11 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#e5322d]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 border-b border-slate-200">
                  {[
                    { id: 'signature', label: 'Signature' },
                    { id: 'initials', label: 'Initials' },
                    { id: 'stamp', label: 'Company Stamp' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSignatureModalTab(tab.id as 'signature' | 'initials' | 'stamp')}
                      className={cn(
                        "px-4 py-2 text-sm font-bold border-b-2 -mb-px",
                        signatureModalTab === tab.id ? "border-[#e5322d] text-[#e5322d]" : "border-transparent text-slate-500"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {signatureModalTab === 'signature' && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {SIGNATURE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setSignaturePreset(preset.id)}
                        className="w-full px-4 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3 text-left hover:bg-slate-50"
                      >
                        <span className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          signaturePreset === preset.id ? "border-emerald-500" : "border-slate-300"
                        )}>
                          {signaturePreset === preset.id && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                        </span>
                        <span style={{ fontFamily: preset.fontFamily }} className={cn("text-2xl", getTextColorClass(signatureColor))}>
                          {fullName || signatureName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {signatureModalTab === 'initials' && (
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-sm text-slate-500 mb-2">Preview</p>
                    <p className={cn("text-4xl font-black", getTextColorClass(signatureColor))}>{initials || 'PP'}</p>
                  </div>
                )}

                {signatureModalTab === 'stamp' && (
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-sm text-slate-500">Company stamp presets are coming next. You can continue with signature and initials now.</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700">Color:</span>
                  {(['black', 'red', 'blue', 'green'] as SignatureColor[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setSignatureColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border-2",
                        c === 'black' ? "bg-black" : c === 'red' ? "bg-red-500" : c === 'blue' ? "bg-blue-500" : "bg-green-500",
                        signatureColor === c ? "ring-2 ring-offset-2 ring-slate-400" : "border-white"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={applySignatureDetails}
                  className="px-6 py-2.5 bg-[#e5322d] hover:bg-[#d42d28] text-white font-bold rounded-lg"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
